import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useSyncState } from '@/db/queries'
import { syncNow } from './engine'

const PUSH_DEBOUNCE = 1200

function maxOf(xs: number[]): number {
  return xs.reduce((m, x) => (x > m ? x : m), 0)
}

/**
 * Keeps the shared tab in step without any plumbing in the repo layer: it simply
 * watches the tab tables through Dexie and syncs whenever their contents change,
 * plus whenever the app comes back to the foreground or the network returns.
 *
 * `syncNow` skips the upload when our side's contents are unchanged, so the
 * pull → apply → (watch fires) → push loop settles after one extra round trip.
 */
export function SyncRunner() {
  const state = useSyncState()
  const paired = !!state

  const signature = useLiveQuery(async () => {
    const [entries, settlements, tombs] = await Promise.all([
      db.tabEntries.toArray(),
      db.tabSettlements.toArray(),
      db.tabTombstones.toArray(),
    ])
    return [
      entries.length,
      maxOf(entries.map((e) => e.updatedAt)),
      settlements.length,
      maxOf(settlements.map((s) => s.updatedAt ?? s.createdAt)),
      tombs.length,
      maxOf(tombs.map((t) => t.deletedAt)),
    ].join(':')
  }, [])

  useEffect(() => {
    if (!paired || signature == null) return
    const id = setTimeout(() => void syncNow(), PUSH_DEBOUNCE)
    return () => clearTimeout(id)
  }, [paired, signature])

  useEffect(() => {
    if (!paired) return
    const run = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    document.addEventListener('visibilitychange', run)
    window.addEventListener('online', run)
    return () => {
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('online', run)
    }
  }, [paired])

  return null
}
