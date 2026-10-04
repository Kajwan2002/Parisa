import Dexie, { type EntityTable } from 'dexie'
import type {
  Category,
  Expense,
  Income,
  Plan,
  PlanPayment,
  Recurring,
  Settings,
  SyncState,
  TabEntry,
  TabSettlement,
  TabTombstone,
} from './types'

// Local-only database. Everything lives on the device; the backup file in
// Settings is the way to move / restore data. Build variants use a distinct
// name (VITE_DB_NAME) so two apps on the same origin never share data.
export const db = new Dexie(import.meta.env.VITE_DB_NAME || 'parisa') as Dexie & {
  categories: EntityTable<Category, 'id'>
  expenses: EntityTable<Expense, 'id'>
  income: EntityTable<Income, 'id'>
  recurring: EntityTable<Recurring, 'id'>
  plans: EntityTable<Plan, 'id'>
  planPayments: EntityTable<PlanPayment, 'id'>
  tabEntries: EntityTable<TabEntry, 'id'>
  tabSettlements: EntityTable<TabSettlement, 'id'>
  tabTombstones: EntityTable<TabTombstone, 'id'>
  syncState: EntityTable<SyncState, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  categories: 'id, sortOrder, isArchived, name',
  // compound-ish indexes we actually query on:
  expenses: 'id, spentOn, categoryId, [categoryId+spentOn]',
  income: 'id, receivedOn, recurringMonthly',
  settings: 'id',
})

// v2 — recurring payments (subscriptions that auto-log as expenses)
db.version(2).stores({
  expenses: 'id, spentOn, categoryId, [categoryId+spentOn], recurringId',
  recurring: 'id, isActive, anchorDate',
})

// v3 — shared "running tab" between two people
db.version(3).stores({
  expenses: 'id, spentOn, categoryId, [categoryId+spentOn], recurringId, tabEntryId',
  tabEntries: 'id, date, paidBy',
  tabSettlements: 'id, date, by',
})

// v4 — syncing the tab (and only the tab) with the other person's phone
db.version(4)
  .stores({
    tabTombstones: 'id, deletedAt',
    syncState: 'id',
  })
  .upgrade(async (tx) => {
    // settlements gain updatedAt so they can take part in last-write-wins
    await tx
      .table('tabSettlements')
      .toCollection()
      .modify((s: TabSettlement) => {
        if (s.updatedAt == null) s.updatedAt = s.createdAt ?? Date.now()
      })
  })

// v5 — installment plans. Purely additive: two new stores, nothing existing is
// touched or re-indexed, so upgrading cannot disturb data already on the phone.
db.version(5).stores({
  plans: 'id, startDate',
  planPayments: 'id, planId, paidOn',
})

/** Ask the browser to keep our data (helps on iOS home-screen installs). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted) {
      if (await navigator.storage.persisted()) return true
    }
    if (navigator.storage?.persist) {
      return await navigator.storage.persist()
    }
  } catch {
    /* not supported — fine */
  }
  return false
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate()
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
    }
  } catch {
    /* ignore */
  }
  return null
}
