// Dev-only harness for exercising tab sync without touching GitHub.
//
// It swaps in an in-memory gist, lets both dev servers be paired with the same
// fixed key, and exposes the encrypted slice so one build's file can be handed to
// the other by hand. That makes the thing that actually matters testable: a row
// written by "her" must read as its mirror image on "him".
//
// Only imported behind `import.meta.env.DEV`, so it never reaches a real build.

import { db } from '@/db/db'
import {
  addSettlement,
  addSharedExpense,
  deleteSettlement,
  deleteSharedExpense,
  getSettings,
  updateSettings,
  updateSharedExpense,
} from '@/db/repo'
import { currentMonthKey } from '@/lib/dates'
import { seal, toB64url, unseal } from './crypto'
import { setGistApi, type GistApi, type GistFiles } from './gist'
import { decodePairing, encodePairing } from './pairing'
import { MY_SIDE, OTHER_SIDE, sliceFile } from './side'
import { syncNow } from './engine'
import {
  entryToWire,
  parseSlice,
  settlementToWire,
  wireToEntry,
  wireToSettlement,
  type Slice,
} from './wire'
import type { TabEntry } from '@/db/types'

/** Same key on both dev servers so slices can be moved between them by hand. */
const TEST_KEY = toB64url(new Uint8Array(32).fill(7))
const TEST_GIST = 'test-gist'

const store: GistFiles = {}

const fake: GistApi = {
  async create(_t, files) {
    Object.assign(store, files)
    return TEST_GIST
  },
  async read() {
    return { status: 'ok', files: { ...store }, etag: null }
  },
  async writeFile(_t, _g, name, content) {
    store[name] = content
  },
}

interface Check {
  name: string
  pass: boolean
  detail?: string
}

function check(name: string, pass: boolean, detail?: string): Check {
  return { name, pass, ...(detail ? { detail } : {}) }
}

/* ------------------------- pure-logic assertions ------------------------- */

/**
 * The whole point: a row stored as "you paid, partner owes" on one phone has to
 * come out as "partner paid, you owe" on the other. Both mappers take `me`
 * explicitly, so both directions can be checked from a single build.
 */
async function pureChecks(): Promise<Check[]> {
  const out: Check[] = []

  // crypto round trip
  const sealed = await seal(TEST_KEY, { hello: 'tab', n: 42 })
  const back = await unseal<{ hello: string; n: number }>(TEST_KEY, sealed)
  out.push(check('crypto round-trips', back.hello === 'tab' && back.n === 42))
  out.push(
    check(
      'ciphertext hides the contents',
      !sealed.includes('hello') && !sealed.includes('tab'),
    ),
  )
  let tamperCaught = false
  try {
    await unseal(toB64url(new Uint8Array(32).fill(9)), sealed)
  } catch {
    tamperCaught = true
  }
  out.push(check('wrong key is rejected', tamperCaught))

  // pairing
  const code = encodePairing({ gistId: 'g', token: 't', key: TEST_KEY, side: OTHER_SIDE })
  const decoded = decodePairing(code)
  out.push(
    check(
      'pairing code round-trips',
      decoded.gistId === 'g' && decoded.token === 't' && decoded.side === OTHER_SIDE,
    ),
  )
  let sameSideCaught = false
  try {
    decodePairing(encodePairing({ gistId: 'g', token: 't', key: TEST_KEY, side: MY_SIDE }))
  } catch {
    sameSideCaught = true
  }
  out.push(check('refuses a code from the same side', sameSideCaught))

  // orientation — "she paid 50, split 25/25" as written on HER phone
  const herRow: TabEntry = {
    id: 'x1',
    total: 5000,
    yourShare: 2500,
    partnerShare: 2500,
    paidBy: 'you',
    categoryId: null,
    note: 'Rewe',
    date: '2026-09-10',
    expenseId: 'e1',
    authorSide: 'her',
    createdAt: 1,
    updatedAt: 2,
  }
  const wire = entryToWire(herRow, { name: 'Groceries', emoji: '🛒' }, 'her')
  const onHim = wireToEntry(wire, 'him')
  const backOnHer = wireToEntry(wire, 'her')
  out.push(check('wire names the payer absolutely', wire.payer === 'her'))
  out.push(
    check(
      'mirrors onto the other phone',
      onHim.paidBy === 'partner' && onHim.yourShare === 2500 && onHim.partnerShare === 2500,
      `paidBy=${onHim.paidBy} yours=${onHim.yourShare}`,
    ),
  )
  out.push(
    check(
      'round-trips unchanged on the author’s phone',
      backOnHer.paidBy === 'you' && backOnHer.yourShare === herRow.yourShare,
    ),
  )

  // uneven split must not swap sides
  const uneven = entryToWire({ ...herRow, yourShare: 1000, partnerShare: 4000 }, null, 'her')
  const unevenHim = wireToEntry(uneven, 'him')
  out.push(
    check(
      'uneven split keeps each share with its owner',
      uneven.shares.her === 1000 &&
        uneven.shares.him === 4000 &&
        unevenHim.yourShare === 4000 &&
        unevenHim.partnerShare === 1000,
    ),
  )

  // settlement direction
  const settleWire = settlementToWire(
    {
      id: 's1',
      amount: 2500,
      by: 'you',
      date: '2026-09-10',
      note: '',
      authorSide: 'her',
      createdAt: 1,
      updatedAt: 1,
    },
    'her',
  )
  out.push(
    check(
      'settlement direction mirrors',
      settleWire.from === 'her' &&
        wireToSettlement(settleWire, 'him').by === 'partner' &&
        wireToSettlement(settleWire, 'her').by === 'you',
    ),
  )

  // validation
  const dirty = parseSlice({
    side: 'her',
    records: [
      { kind: 'entry', id: 'ok', payer: 'her', shares: { her: 10, him: 5 }, total: 99999, date: '2026-09-01', author: 'her', updatedAt: 5 },
      { kind: 'entry', id: 'nodate', payer: 'her', shares: { her: 1, him: 1 }, author: 'her', updatedAt: 5 },
      { kind: 'entry', id: 'badside', payer: 'nobody', shares: {}, date: '2026-09-01', author: 'her', updatedAt: 5 },
      { kind: 'mystery', id: 'weird', author: 'her', updatedAt: 5 },
      null,
    ],
  })
  const kept = dirty?.records[0]
  out.push(
    check(
      'drops malformed records, repairs a wrong total',
      dirty?.records.length === 1 &&
        kept?.id === 'ok' &&
        kept.kind === 'entry' &&
        kept.total === 15,
      `kept ${dirty?.records.length}`,
    ),
  )
  out.push(check('rejects a slice with no side', parseSlice({ records: [] }) === null))

  return out
}

/* --------------------------- live engine helpers -------------------------- */

/** Pair this build against the in-memory gist (no GitHub, no token). */
async function pairFake(): Promise<void> {
  setGistApi(fake)
  await db.syncState.put({
    id: 'sync',
    gistId: TEST_GIST,
    token: 'test',
    key: TEST_KEY,
    etag: null,
    pushedHash: null,
    lastPulledAt: null,
    lastPushedAt: null,
    lastError: null,
    pairedAt: Date.now(),
  })
}

async function dump() {
  const [entries, settlements, expenses, tombs, cats, settings] = await Promise.all([
    db.tabEntries.toArray(),
    db.tabSettlements.toArray(),
    db.expenses.toArray(),
    db.tabTombstones.toArray(),
    db.categories.toArray(),
    getSettings(),
  ])
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? null
  return {
    side: MY_SIDE,
    autoLog: settings.tabAutoLogShare,
    entries: entries.map((e) => ({
      id: e.id,
      note: e.note,
      total: e.total,
      paidBy: e.paidBy,
      yourShare: e.yourShare,
      partnerShare: e.partnerShare,
      author: e.authorSide,
      category: catName(e.categoryId),
      expenseId: e.expenseId,
      updatedAt: e.updatedAt,
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      by: s.by,
      author: s.authorSide,
    })),
    expenses: expenses.map((x) => ({
      id: x.id,
      amount: x.amount,
      note: x.note,
      category: catName(x.categoryId),
      tabEntryId: x.tabEntryId ?? null,
    })),
    tombstones: tombs.map((t) => t.id),
  }
}

/** The dashboard's cash view for this month, recomputed outside React. */
async function cash(): Promise<{ cashSpent: number; consumption: number; byCategory: unknown }> {
  const monthKey = currentMonthKey()
  const [expenses, tabEntries, settlements] = await Promise.all([
    db.expenses.where('spentOn').startsWith(monthKey).toArray(),
    db.tabEntries.where('date').startsWith(monthKey).toArray(),
    db.tabSettlements.where('date').startsWith(monthKey).toArray(),
  ])
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const consumption = sum(expenses.map((e) => e.amount))
  const fronted = sum(tabEntries.filter((t) => t.paidBy === 'you').map((t) => t.partnerShare))
  const unpaid = sum(tabEntries.filter((t) => t.paidBy === 'partner').map((t) => t.yourShare))
  const out = sum(settlements.filter((s) => s.by === 'you').map((s) => s.amount))
  const inn = sum(settlements.filter((s) => s.by === 'partner').map((s) => s.amount))
  return {
    consumption,
    cashSpent: consumption + fronted - unpaid + out - inn,
    byCategory: { fronted, unpaid, out, inn },
  }
}

export interface TabSyncTestApi {
  side: typeof MY_SIDE
  pureChecks: () => Promise<Check[]>
  pairFake: () => Promise<void>
  syncNow: typeof syncNow
  /** the encrypted file this build published */
  myFile: () => string | undefined
  /** hand over the other build's published file */
  putTheirFile: (content: string) => void
  /** decrypted view of any slice, for eyeballing */
  peek: (content: string) => Promise<Slice | null>
  files: () => string[]
  dump: typeof dump
  cash: typeof cash
  reset: () => Promise<void>
  /** the real repo calls the UI uses, so tests drive production code paths */
  repo: {
    addSharedExpense: typeof addSharedExpense
    updateSharedExpense: typeof updateSharedExpense
    deleteSharedExpense: typeof deleteSharedExpense
    addSettlement: typeof addSettlement
    deleteSettlement: typeof deleteSettlement
    updateSettings: typeof updateSettings
    categoryIdByName: (name: string) => Promise<string | null>
  }
}

export function installSelfTest(): void {
  const api: TabSyncTestApi = {
    side: MY_SIDE,
    pureChecks,
    pairFake,
    syncNow,
    myFile: () => store[sliceFile(MY_SIDE)],
    putTheirFile: (content) => {
      store[sliceFile(OTHER_SIDE)] = content
    },
    peek: async (content) => parseSlice(await unseal<unknown>(TEST_KEY, content)),
    files: () => Object.keys(store),
    dump,
    cash,
    reset: async () => {
      await db.syncState.delete('sync')
      await db.tabTombstones.clear()
      setGistApi(null)
      for (const k of Object.keys(store)) delete store[k]
    },
    repo: {
      addSharedExpense,
      updateSharedExpense,
      deleteSharedExpense,
      addSettlement,
      deleteSettlement,
      updateSettings,
      categoryIdByName: async (name) => {
        const all = await db.categories.toArray()
        return all.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null
      },
    },
  }
  ;(window as unknown as Record<string, unknown>).__tabSync = api
}
