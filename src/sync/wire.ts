import type { DateStr } from '@/lib/dates'
import type { Category, Side, TabEntry, TabParty, TabSettlement } from '@/db/types'
import { other } from './side'

// ------------------------------------------------------------------------- //
// The canonical, *absolute* shape of a tab row.
//
// Locally a row says "you paid, partner owes". That is meaningless to the other
// phone, so on the wire everything is named: `payer: 'her'`, `shares.him: 2500`.
// Both mappers below take `me` explicitly rather than reading MY_SIDE, which
// keeps them pure and lets both directions be tested from one build.
// ------------------------------------------------------------------------- //

export const SLICE_VERSION = 1

export interface WireEntry {
  kind: 'entry'
  id: string
  total: number // cents, = shares.her + shares.him
  payer: Side
  shares: { her: number; him: number }
  note: string
  /** category by *name* — ids are local to each phone and never shared */
  category: { name: string; emoji: string } | null
  date: DateStr
  author: Side
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export interface WireSettlement {
  kind: 'settle'
  id: string
  amount: number
  /** who handed over the money */
  from: Side
  note: string
  date: DateStr
  author: Side
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export type WireRecord = WireEntry | WireSettlement

/** One side's file in the gist (encrypted before it is written). */
export interface Slice {
  v: number
  side: Side
  writtenAt: number
  records: WireRecord[]
}

/* ------------------------------- outbound ------------------------------- */

export function entryToWire(
  e: TabEntry,
  cat: Pick<Category, 'name' | 'emoji'> | null,
  me: Side,
): WireEntry {
  const them = other(me)
  const shares = { her: 0, him: 0 }
  shares[me] = e.yourShare
  shares[them] = e.partnerShare
  return {
    kind: 'entry',
    id: e.id,
    total: e.total,
    payer: e.paidBy === 'you' ? me : them,
    shares,
    note: e.note,
    category: cat ? { name: cat.name, emoji: cat.emoji } : null,
    date: e.date,
    author: e.authorSide ?? me,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export function settlementToWire(s: TabSettlement, me: Side): WireSettlement {
  return {
    kind: 'settle',
    id: s.id,
    amount: s.amount,
    from: s.by === 'you' ? me : other(me),
    note: s.note,
    date: s.date,
    author: s.authorSide ?? me,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt ?? s.createdAt,
  }
}

export function tombstone(
  id: string,
  kind: 'entry' | 'settle',
  deletedAt: number,
  me: Side,
): WireRecord {
  const base = { id, author: me, createdAt: deletedAt, updatedAt: deletedAt, deleted: true as const }
  return kind === 'entry'
    ? {
        ...base,
        kind: 'entry',
        total: 0,
        payer: me,
        shares: { her: 0, him: 0 },
        note: '',
        category: null,
        date: '1970-01-01',
      }
    : { ...base, kind: 'settle', amount: 0, from: me, note: '', date: '1970-01-01' }
}

/* ------------------------------- inbound -------------------------------- */

export interface LocalEntryFields {
  total: number
  yourShare: number
  partnerShare: number
  paidBy: TabParty
  note: string
  date: DateStr
  authorSide: Side
  createdAt: number
  updatedAt: number
}

/** Turn an absolute record back into this phone's point of view. */
export function wireToEntry(w: WireEntry, me: Side): LocalEntryFields {
  return {
    total: w.total,
    yourShare: w.shares[me],
    partnerShare: w.shares[other(me)],
    paidBy: w.payer === me ? 'you' : 'partner',
    note: w.note,
    date: w.date,
    authorSide: w.author,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

export interface LocalSettlementFields {
  amount: number
  by: TabParty
  note: string
  date: DateStr
  authorSide: Side
  createdAt: number
  updatedAt: number
}

export function wireToSettlement(w: WireSettlement, me: Side): LocalSettlementFields {
  return {
    amount: w.amount,
    by: w.from === me ? 'you' : 'partner',
    note: w.note,
    date: w.date,
    authorSide: w.author,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

/* ------------------------------ validation ------------------------------ */
// Everything here came off the network. It is data, never instructions: parse
// defensively, clamp to the invariants the UI relies on, drop anything odd.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_CENTS = 1_000_000_00 // a million euros; anything above is a bad record

function isSide(v: unknown): v is Side {
  return v === 'her' || v === 'him'
}
function cents(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0
  return Math.min(MAX_CENTS, Math.max(0, n))
}
function text(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
function stamp(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0
}

function parseRecord(raw: unknown): WireRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = text(r.id, 64)
  const author = isSide(r.author) ? r.author : null
  const updatedAt = stamp(r.updatedAt)
  if (!id || !author || !updatedAt) return null
  const createdAt = stamp(r.createdAt) || updatedAt
  const deleted = r.deleted === true
  const date = typeof r.date === 'string' && DATE_RE.test(r.date) ? r.date : null
  const note = text(r.note)

  if (r.kind === 'entry') {
    if (!deleted && !date) return null
    const payer = isSide(r.payer) ? r.payer : null
    if (!payer) return null
    const sh = (r.shares ?? {}) as Record<string, unknown>
    const shares = { her: cents(sh.her), him: cents(sh.him) }
    // the split is the source of truth; a mismatched total is repaired, not trusted
    const total = shares.her + shares.him
    let category: WireEntry['category'] = null
    if (r.category && typeof r.category === 'object') {
      const c = r.category as Record<string, unknown>
      const name = text(c.name, 40)
      if (name) category = { name, emoji: text(c.emoji, 8) }
    }
    return {
      kind: 'entry',
      id,
      total,
      payer,
      shares,
      note,
      category,
      date: date ?? '1970-01-01',
      author,
      createdAt,
      updatedAt,
      ...(deleted ? { deleted: true } : {}),
    }
  }

  if (r.kind === 'settle') {
    if (!deleted && !date) return null
    const from = isSide(r.from) ? r.from : null
    if (!from) return null
    return {
      kind: 'settle',
      id,
      amount: cents(r.amount),
      from,
      note,
      date: date ?? '1970-01-01',
      author,
      createdAt,
      updatedAt,
      ...(deleted ? { deleted: true } : {}),
    }
  }

  return null
}

/** Validate a decrypted slice, keeping only well-formed records. */
export function parseSlice(raw: unknown): Slice | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (!isSide(s.side)) return null
  const list = Array.isArray(s.records) ? s.records : []
  const records: WireRecord[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const rec = parseRecord(item)
    if (!rec) continue
    const key = `${rec.kind}:${rec.id}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push(rec)
  }
  return {
    v: typeof s.v === 'number' ? s.v : SLICE_VERSION,
    side: s.side,
    writtenAt: stamp(s.writtenAt),
    records,
  }
}
