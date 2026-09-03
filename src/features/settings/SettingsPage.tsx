import { type ChangeEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Screen } from '@/components/Screen'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { exportBackup, importBackup, wipeAll } from '@/db/backup'
import { ensureSeeded } from '@/db/seed'
import { updateSettings } from '@/db/repo'
import { useSettings } from '@/db/queries'
import { ACCENTS, accentFor, applyAccent } from './accents'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN']

export function SettingsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  const [confirmImport, setConfirmImport] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  const lastBackup = settings?.lastBackupAt
    ? `Last backup ${formatDistanceToNow(settings.lastBackupAt, { addSuffix: true })}`
    : 'Never backed up yet'
  const stale =
    !settings?.lastBackupAt || Date.now() - settings.lastBackupAt > 1000 * 60 * 60 * 24 * 14

  async function doExport() {
    try {
      setBusy(true)
      const how = await exportBackup()
      toast(how === 'shared' ? 'Backup ready to save 💾' : 'Backup downloaded 💾')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Could not export')
    } finally {
      setBusy(false)
    }
  }

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    setConfirmImport(text)
  }

  async function doImport(text: string) {
    setConfirmImport(null)
    try {
      setBusy(true)
      const r = await importBackup(text)
      await ensureSeeded()
      toast(`Restored ${r.expenses} expenses 🌸`)
    } catch (err) {
      toast((err as Error).message || 'Could not import')
    } finally {
      setBusy(false)
    }
  }

  async function doReset() {
    setConfirmReset(false)
    setBusy(true)
    await wipeAll()
    await ensureSeeded()
    applyAccent(ACCENTS[0].base)
    setBusy(false)
    toast('Everything reset')
  }

  const currency = settings?.currency ?? 'EUR'
  const activeAccent = accentFor(settings?.themeAccent)

  return (
    <Screen title="Settings">
      {/* backup */}
      <section>
        <SectionTitle>Backup</SectionTitle>
        <Card className="mt-1 flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Everything is stored only on this phone. Save a backup file now and then (to your
            Files / iCloud Drive) so nothing is ever lost.
          </p>
          <p
            className={cn(
              'text-xs font-bold',
              stale ? 'text-over' : 'text-ink-faint',
            )}
          >
            {stale ? '⚠ ' : ''}
            {lastBackup}
          </p>
          <div className="flex gap-2">
            <Button full disabled={busy} onClick={doExport}>
              Export backup
            </Button>
            <Button variant="soft" full disabled={busy} onClick={() => fileRef.current?.click()}>
              Import
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onFilePicked}
          />
        </Card>
      </section>

      {/* manage */}
      <section>
        <SectionTitle>Manage</SectionTitle>
        <Card className="mt-1 divide-y divide-surface-2 p-0">
          <Row label="Categories" emoji="🏷️" onClick={() => navigate('/settings/categories')} />
          <Row label="Budgets" emoji="🎯" onClick={() => navigate('/budgets')} />
          <Row label="Recurring payments" emoji="🔁" onClick={() => navigate('/recurring')} />
          <Row label="Income" emoji="💶" onClick={() => navigate('/income')} />
        </Card>
      </section>

      {/* currency */}
      <section>
        <SectionTitle>Currency</SectionTitle>
        <Card className="mt-1">
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateSettings({ currency: c })}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-bold transition',
                  currency === c ? 'bg-rose text-white' : 'bg-blush/60 text-ink-soft',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* accent */}
      <section>
        <SectionTitle>Theme</SectionTitle>
        <Card className="mt-1 flex items-center gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              onClick={() => {
                applyAccent(a.base)
                updateSettings({ themeAccent: a.base })
              }}
              className={cn(
                'h-9 w-9 rounded-full transition',
                activeAccent.id === a.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : '',
              )}
              style={{ background: a.base }}
            />
          ))}
        </Card>
      </section>

      {/* danger */}
      <section>
        <SectionTitle>Danger zone</SectionTitle>
        <Card className="mt-1">
          <Button variant="danger" full disabled={busy} onClick={() => setConfirmReset(true)}>
            Reset all data
          </Button>
        </Card>
      </section>

      <p className="py-2 text-center text-xs font-semibold text-ink-faint">
        Parisa · made with 💕
      </p>

      <ConfirmDialog
        open={confirmImport !== null}
        title="Import this backup?"
        message="This replaces everything currently in the app with the contents of the file."
        confirmLabel="Replace & import"
        danger
        onConfirm={() => confirmImport && doImport(confirmImport)}
        onCancel={() => setConfirmImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="All expenses, income and custom categories will be deleted and the prebuilt categories restored. Export a backup first if you're not sure."
        confirmLabel="Reset everything"
        danger
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </Screen>
  )
}

function Row({ label, emoji, onClick }: { label: string; emoji: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left first:rounded-t-3xl last:rounded-b-3xl active:bg-blush/40"
    >
      <span className="text-lg">{emoji}</span>
      <span className="flex-1 font-bold text-ink">{label}</span>
      <span className="text-ink-faint">›</span>
    </button>
  )
}
