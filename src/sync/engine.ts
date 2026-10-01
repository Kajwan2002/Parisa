import { db } from '@/db/db'
import {
  applyRemoteDelete,
  applyRemoteEntry,
  applyRemoteSettlement,
  getSettings,
  tombstoneKey,
} from '@/db/repo'
import type { SyncState } from '@/db/types'
import { digest, randomKey, seal, unseal } from './crypto'
import { gists, SyncError } from './gist'
import { encodePairing, type Pairing } from './pairing'
import { MY_SIDE, OTHER_SIDE, sliceFile, type Side } from './side'
import {
  SLICE_VERSION,
  entryToWire,
  parseSlice,
  settlementToWire,
  tombstone,
  wireToEntry,
  wireToSettlement,
  type Slice,
  type WireRecord,
} from './wire'

const GIST_DESCRIPTION = 'Shared tab (encrypted) — created by Parisa'
/** How long a delete is remembered. Far longer than either phone stays offline. */
const TOMBSTONE_TTL = 1000 * 60 * 60 * 24 * 180

/* --------------------------------- state --------------------------------- */

export interface SyncStatus {
  paired: boolean
  /** this build's fixed identity — shown in the UI so orientation is visible */
  side: Side
  syncing: boolean
  lastPulledAt: number | null
  lastPushedAt: number | null
  lastError: string | null
}

export function statusOf(state: SyncState | undefined, syncing: boolean): SyncStatus {
  return {
    paired: !!state,
    side: MY_SIDE,
    syncing,
    lastPulledAt: state?.lastPulledAt ?? null,
    lastPushedAt: state?.lastPushedAt ?? null,
    lastError: state?.lastError ?? null,
  }
}

export function pairingCodeFor(state: SyncState): string {
  return encodePairing({
    gistId: state.gistId,
    token: state.token,
    key: state.key,
    side: MY_SIDE,
  })
}

/* ------------------------------ local slice ------------------------------ */

/**
 * Everything this phone publishes: its live tab rows plus its own tombstones.
 * Derived fresh each time rather than kept in a mirror table, so a lost or
 * corrupted file simply heals on the next push.
 */
async function buildSlice(): Promise<Slice> {
  const [entries, settlements, tombs, categories] = await Promise.all([
    db.tabEntries.toArray(),
    db.tabSettlements.toArray(),
    db.tabTombstones.toArray(),
    db.categories.toArray(),
  ])
  const catById = new Map(categories.map((c) => [c.id, c]))
  const live = new Set<string>([
    ...entries.map((e) => tombstoneKey('entry', e.id)),
    ...settlements.map((s) => tombstoneKey('settle', s.id)),
  ])
  const cutoff = Date.now() - TOMBSTONE_TTL

  const records: WireRecord[] = [
    ...entries.map((e) =>
      entryToWire(e, e.categoryId ? (catById.get(e.categoryId) ?? null) : null, MY_SIDE),
    ),
    ...settlements.map((s) => settlementToWire(s, MY_SIDE)),
    ...tombs
      .filter((t) => t.deletedAt > cutoff && !live.has(t.id))
      .map((t) => tombstone(t.recordId, t.kind, t.deletedAt, MY_SIDE)),
  ]

  return { v: SLICE_VERSION, side: MY_SIDE, writtenAt: Date.now(), records }
}

/** Stable hash of a slice's contents, ignoring when it was written. */
async function sliceHash(slice: Slice): Promise<string> {
  const canonical = [...slice.records]
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
    .map((r) => JSON.stringify(r))
    .join('\n')
  return digest(canonical)
}

/* -------------------------------- merging -------------------------------- */

/** Newest we know about a row here — a delete counts as a write. */
async function localUpdatedAt(kind: 'entry' | 'settle', id: string): Promise<number> {
  const [tomb, live] = await Promise.all([
    db.tabTombstones.get(tombstoneKey(kind, id)),
    kind === 'entry' ? db.tabEntries.get(id) : db.tabSettlements.get(id),
  ])
  return Math.max(tomb?.deletedAt ?? -1, live?.updatedAt ?? -1)
}

/**
 * Last-write-wins per row. Rows are independent, so there is no invariant
 * spanning two of them that this could break.
 *
 * A tombstone beats an older row, which is what stops a manual delete from being
 * resurrected by the other phone republishing its copy. (An *edit* newer than
 * the delete does win and brings the row back — that's LWW behaving correctly.)
 */
async function applyRemote(records: WireRecord[], autoLog: boolean): Promise<number> {
  let changed = 0
  for (const rec of records) {
    const kind = rec.kind
    const localAt = await localUpdatedAt(kind, rec.id)
    if (rec.updatedAt <= localAt) continue

    if (rec.deleted) {
      const exists =
        kind === 'entry' ? await db.tabEntries.get(rec.id) : await db.tabSettlements.get(rec.id)
      if (exists) {
        await applyRemoteDelete(kind, rec.id, rec.updatedAt)
        changed++
      }
      continue
    }

    if (rec.kind === 'entry') {
      await applyRemoteEntry(rec.id, wireToEntry(rec, MY_SIDE), rec.category, autoLog)
    } else {
      await applyRemoteSettlement(rec.id, wireToSettlement(rec, MY_SIDE))
    }
    changed++
  }
  return changed
}

async function pruneTombstones(): Promise<void> {
  const cutoff = Date.now() - TOMBSTONE_TTL
  const stale = await db.tabTombstones.where('deletedAt').below(cutoff).primaryKeys()
  if (stale.length) await db.tabTombstones.bulkDelete(stale)
}

/* ------------------------------- the cycle ------------------------------- */

export interface SyncResult {
  ok: boolean
  /** rows taken from the other phone */
  applied: number
  pushed: boolean
  error: string | null
  unpaired?: boolean
}

let inflight: Promise<SyncResult> | null = null
const listeners = new Set<(syncing: boolean) => void>()

export function onSyncActivity(fn: (syncing: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function announce(syncing: boolean) {
  for (const fn of listeners) fn(syncing)
}

/** Pull, merge, then push — coalesced so overlapping calls share one round trip. */
export function syncNow(): Promise<SyncResult> {
  if (!inflight) {
    announce(true)
    inflight = runSync().finally(() => {
      inflight = null
      announce(false)
    })
  }
  return inflight
}

async function runSync(): Promise<SyncResult> {
  const state = await db.syncState.get('sync')
  if (!state) return { ok: true, applied: 0, pushed: false, error: null, unpaired: true }

  const patch: Partial<SyncState> = {}
  let applied = 0
  let pushed = false

  try {
    // ---- pull
    const read = await gists.read(state.token, state.gistId, state.etag)
    if (read.status === 'ok') {
      patch.etag = read.etag
      const theirs = read.files[sliceFile(OTHER_SIDE)]
      if (theirs) {
        const slice = parseSlice(await unseal<unknown>(state.key, theirs))
        // a file claiming to be *our* side would mean both phones think they're
        // the same person — refuse it rather than invert every debt
        if (slice && slice.side === OTHER_SIDE) {
          const settings = await getSettings()
          applied = await applyRemote(slice.records, settings.tabAutoLogShare)
        }
      }
      patch.lastPulledAt = Date.now()
    }

    // ---- push (only when our contents actually differ from what's up there)
    const slice = await buildSlice()
    const hash = await sliceHash(slice)
    if (hash !== state.pushedHash) {
      await gists.writeFile(
        state.token,
        state.gistId,
        sliceFile(MY_SIDE),
        await seal(state.key, slice),
      )
      patch.pushedHash = hash
      patch.lastPushedAt = Date.now()
      // our own write changes the gist, so the cached ETag is stale
      patch.etag = null
      pushed = true
    }

    patch.lastError = null
    await db.syncState.update('sync', patch)
    await pruneTombstones()
    return { ok: true, applied, pushed, error: null }
  } catch (err) {
    const message =
      err instanceof SyncError ? err.message : ((err as Error).message || 'Sync failed.')
    await db.syncState.update('sync', { ...patch, lastError: message })
    return { ok: false, applied, pushed, error: message }
  }
}

/* ------------------------------- pairing --------------------------------- */

/**
 * Create the shared gist and return the pairing code for the other phone.
 * The token never leaves the device except in requests to GitHub itself, and the
 * encryption key is generated here and exists only inside the code.
 */
export async function startSync(token: string): Promise<string> {
  const clean = token.trim()
  if (!clean) throw new SyncError('auth', 'Paste your GitHub token first.')
  const key = randomKey()
  const slice = await buildSlice()
  const gistId = await gists.create(
    clean,
    { [sliceFile(MY_SIDE)]: await seal(key, slice) },
    GIST_DESCRIPTION,
  )
  const now = Date.now()
  await db.syncState.put({
    id: 'sync',
    gistId,
    token: clean,
    key,
    etag: null,
    pushedHash: await sliceHash(slice),
    lastPulledAt: null,
    lastPushedAt: now,
    lastError: null,
    pairedAt: now,
  })
  return pairingCodeFor((await db.syncState.get('sync'))!)
}

/** Join the gist the other phone created, then do a first full sync. */
export async function joinSync(p: Pairing): Promise<SyncResult> {
  await db.syncState.put({
    id: 'sync',
    gistId: p.gistId,
    token: p.token,
    key: p.key,
    etag: null,
    pushedHash: null,
    lastPulledAt: null,
    lastPushedAt: null,
    lastError: null,
    pairedAt: Date.now(),
  })
  const r = await syncNow()
  if (!r.ok) {
    // a bad code / revoked token shouldn't leave the app looking paired
    await db.syncState.delete('sync')
  }
  return r
}

export async function unpairSync(): Promise<void> {
  await db.syncState.delete('sync')
}
