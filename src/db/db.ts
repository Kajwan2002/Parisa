import Dexie, { type EntityTable } from 'dexie'
import type { Category, Expense, Income, Recurring, Settings } from './types'

// Local-only database. Everything lives on the device; the backup file in
// Settings is the way to move / restore data.
export const db = new Dexie('parisa') as Dexie & {
  categories: EntityTable<Category, 'id'>
  expenses: EntityTable<Expense, 'id'>
  income: EntityTable<Income, 'id'>
  recurring: EntityTable<Recurring, 'id'>
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
