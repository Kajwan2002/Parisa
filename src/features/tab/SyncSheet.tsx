import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { useSettings, useSyncState } from '@/db/queries'
import { updateSettings } from '@/db/repo'
import { joinSync, pairingCodeFor, startSync, syncNow, unpairSync } from '@/sync/engine'
import { decodePairing } from '@/sync/pairing'
import { MY_SIDE, OTHER_SIDE, SIDE_APP } from '@/sync/side'
import { cheer } from '@/theme/apply'

const TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=Shared%20tab%20sync'

type Mode = 'menu' | 'setup' | 'code' | 'join'

export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const state = useSyncState()
  const settings = useSettings()
  const paired = !!state

  const [mode, setMode] = useState<Mode>('menu')
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmUnpair, setConfirmUnpair] = useState(false)

  useEffect(() => {
    if (!open) {
      setMode('menu')
      setToken('')
      setCode('')
      setJoinCode('')
      setError(null)
    }
  }, [open])

  const partner = settings?.partnerName?.trim() || 'them'

  async function share(text: string, what: string) {
    try {
      if (navigator.share) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
      toast(cheer(`${what} copied 📋`))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Could not copy')
    }
  }

  async function doSetup() {
    setError(null)
    setBusy(true)
    try {
      setCode(await startSync(token))
      setToken('')
      setMode('code')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doJoin() {
    setError(null)
    setBusy(true)
    try {
      const p = decodePairing(joinCode)
      const r = await joinSync(p)
      if (!r.ok) throw new Error(r.error ?? 'Could not connect.')
      toast(cheer('Tab synced 🤝'))
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doSyncNow() {
    setBusy(true)
    const r = await syncNow()
    setBusy(false)
    toast(r.ok ? cheer(r.applied > 0 ? `Updated · ${r.applied} change(s) 🤝` : 'Up to date ✓') : r.error!)
  }

  return (
    <Sheet open={open} onClose={onClose} title={paired ? 'Tab sync' : 'Sync the tab'}>
      <div className="flex flex-col gap-4 pb-2">
        {/* who this phone is — the orientation is never hidden */}
        <div className="rounded-2xl bg-blush/50 px-4 py-3 text-sm">
          <p className="font-bold text-ink">
            This phone is <span className="text-rose-deep">{SIDE_APP[MY_SIDE]}</span>
          </p>
          <p className="text-xs font-semibold text-ink-faint">
            It pairs with {SIDE_APP[OTHER_SIDE]}
            {partner !== 'them' && partner !== SIDE_APP[OTHER_SIDE] ? ` — ${partner}’s phone` : ''}.
            Only the shared tab is synced — your expenses, categories, income and budgets never
            leave this phone.
          </p>
        </div>

        {error && (
          <p className="rounded-2xl bg-over/15 px-4 py-3 text-sm font-semibold text-over">
            {error}
          </p>
        )}

        {paired ? (
          <PairedPanel
            lastPulledAt={state.lastPulledAt}
            lastError={state.lastError}
            autoLog={settings?.tabAutoLogShare ?? true}
            busy={busy}
            code={code}
            onAutoLog={(v) => updateSettings({ tabAutoLogShare: v })}
            onSyncNow={doSyncNow}
            onShowCode={() => setCode(pairingCodeFor(state))}
            onShare={() => share(code, 'Pairing code')}
            onUnpair={() => setConfirmUnpair(true)}
          />
        ) : mode === 'menu' ? (
          <div className="flex flex-col gap-2">
            <Button full onClick={() => setMode('setup')}>
              Set up sync on this phone
            </Button>
            <Button variant="soft" full onClick={() => setMode('join')}>
              I have a pairing code
            </Button>
            <p className="px-1 pt-1 text-xs font-semibold text-ink-faint">
              Set it up on one phone, then join from the other.
            </p>
          </div>
        ) : mode === 'setup' ? (
          <div className="flex flex-col gap-3">
            <ol className="flex flex-col gap-2 text-sm text-ink-soft">
              <li>
                <span className="font-bold text-ink">1.</span> Make a GitHub token with{' '}
                <strong>only</strong> the “gist” box ticked, and no expiry —{' '}
                <a
                  href={TOKEN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-rose-deep underline"
                >
                  open that page
                </a>
                .
              </li>
              <li>
                <span className="font-bold text-ink">2.</span> Paste it here. It’s stored on this
                phone and only ever sent to GitHub.
              </li>
            </ol>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl bg-surface px-4 py-3 font-mono text-sm font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
            />
            <Button full disabled={busy || !token.trim()} onClick={doSetup}>
              {busy ? 'Creating…' : 'Create the shared tab'}
            </Button>
            <Button variant="ghost" full onClick={() => setMode('menu')}>
              Back
            </Button>
          </div>
        ) : mode === 'code' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Send this to {partner}, and have them paste it into{' '}
              <strong>{SIDE_APP[OTHER_SIDE]}</strong> → Shared tab → Sync. Delete the message
              afterwards — the code carries the token.
            </p>
            <CodeBox code={code} />
            <Button full onClick={() => share(code, 'Pairing code')}>
              Copy / send the code
            </Button>
            <Button variant="ghost" full onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Paste the pairing code from <strong>{SIDE_APP[OTHER_SIDE]}</strong>.
            </p>
            <textarea
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              rows={4}
              placeholder="PARISATAB1.…"
              autoComplete="off"
              spellCheck={false}
              className="w-full resize-none rounded-2xl bg-surface px-4 py-3 font-mono text-xs font-semibold break-all text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
            />
            <Button full disabled={busy || !joinCode.trim()} onClick={doJoin}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
            <Button variant="ghost" full onClick={() => setMode('menu')}>
              Back
            </Button>
          </div>
        )}

        {!paired && (
          <p className="px-1 text-xs font-semibold text-ink-faint">
            The tab is encrypted on this phone before it’s uploaded, so only the two of you can
            read it.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnpair}
        title="Stop syncing the tab?"
        message="Both phones keep everything they already have — they just stop updating each other. You can pair again later."
        confirmLabel="Stop syncing"
        danger
        onConfirm={async () => {
          setConfirmUnpair(false)
          await unpairSync()
          toast('Sync turned off')
        }}
        onCancel={() => setConfirmUnpair(false)}
      />
    </Sheet>
  )
}

function CodeBox({ code }: { code: string }) {
  return (
    <p className="max-h-32 overflow-y-auto rounded-2xl bg-bg-deep px-4 py-3 font-mono text-[0.7rem] leading-relaxed font-semibold break-all text-ink-soft">
      {code}
    </p>
  )
}

function PairedPanel({
  lastPulledAt,
  lastError,
  autoLog,
  busy,
  code,
  onAutoLog,
  onSyncNow,
  onShowCode,
  onShare,
  onUnpair,
}: {
  lastPulledAt: number | null
  lastError: string | null
  autoLog: boolean
  busy: boolean
  code: string
  onAutoLog: (v: boolean) => void
  onSyncNow: () => void
  onShowCode: () => void
  onShare: () => void
  onUnpair: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
        <p className={cn('font-bold', lastError ? 'text-over' : 'text-good')}>
          {lastError ? 'Sync paused' : 'Synced ✓'}
        </p>
        <p className="text-xs font-semibold text-ink-faint">
          {lastError ??
            (lastPulledAt
              ? `Last checked ${formatDistanceToNow(lastPulledAt, { addSuffix: true })}`
              : 'Not checked yet')}
        </p>
      </div>

      <label className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
        <span className="font-bold text-ink">
          Log my share
          <span className="block text-xs font-semibold text-ink-faint">
            Shared expenses they add also count in your own history and budgets
          </span>
        </span>
        <input
          type="checkbox"
          checked={autoLog}
          onChange={(e) => onAutoLog(e.target.checked)}
          className="ml-3 h-6 w-6 shrink-0 accent-[var(--color-rose)]"
        />
      </label>

      <Button variant="soft" full disabled={busy} onClick={onSyncNow}>
        {busy ? 'Syncing…' : 'Sync now'}
      </Button>

      {code ? (
        <>
          <CodeBox code={code} />
          <Button variant="soft" full onClick={onShare}>
            Copy / send the code
          </Button>
        </>
      ) : (
        <Button variant="ghost" full onClick={onShowCode}>
          Show pairing code
        </Button>
      )}

      <Button variant="danger" full onClick={onUnpair}>
        Stop syncing
      </Button>
    </div>
  )
}
