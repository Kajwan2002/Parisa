import { newId } from '@/lib/id'
import { db, requestPersistentStorage } from './db'
import { DEFAULT_SETTINGS, type Category } from './types'

type Seed = Pick<Category, 'name' | 'emoji' | 'color'>

// Prebuilt categories. All of them are fully editable and deletable.
const DEFAULT_CATEGORIES: Seed[] = [
  { name: 'Groceries', emoji: '🛒', color: '#c8e6a8' },
  { name: 'Eating out', emoji: '🍜', color: '#ffc5a1' },
  { name: 'Coffee & treats', emoji: '☕', color: '#d9c3b0' },
  { name: 'Transport', emoji: '🚌', color: '#a9d8ef' },
  { name: 'Shopping', emoji: '🛍️', color: '#f6b7d4' },
  { name: 'Beauty', emoji: '💅', color: '#f7a8c4' },
  { name: 'Health', emoji: '💊', color: '#a7e0cf' },
  { name: 'Home', emoji: '🏠', color: '#b9c8f2' },
  { name: 'Subscriptions', emoji: '📺', color: '#c7b4e6' },
  { name: 'Fun', emoji: '🎉', color: '#ffe0a3' },
  { name: 'Gifts', emoji: '🎁', color: '#e0b3d8' },
  { name: 'Travel', emoji: '✈️', color: '#a9d8ef' },
  { name: 'Other', emoji: '🌸', color: '#f4978e' },
]

/** id of the fallback category, used when a category is deleted. */
export const OTHER_CATEGORY_NAME = 'Other'

/**
 * Runs once. Creates the settings row and the prebuilt categories.
 * Safe to call on every startup — it no-ops if already seeded.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.categories, async () => {
    const existing = await db.settings.get('app')
    if (existing?.seeded) return

    const now = Date.now()
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((c, i) => ({
        id: newId(),
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        monthlyBudget: null,
        sortOrder: i,
        isArchived: false,
        isDefault: true,
        createdAt: now,
      })),
    )

    await db.settings.put({
      ...DEFAULT_SETTINGS,
      ...existing,
      id: 'app',
      seeded: true,
      createdAt: existing?.createdAt ?? now,
    })
  })

  void requestPersistentStorage()
}

/** Best-effort lookup of a sensible fallback category for reassignment. */
export async function fallbackCategoryId(excludeId?: string): Promise<string | null> {
  const cats = await db.categories.filter((c) => !c.isArchived && c.id !== excludeId).toArray()
  if (cats.length === 0) return null
  const other = cats.find((c) => c.name.toLowerCase() === OTHER_CATEGORY_NAME.toLowerCase())
  return (other ?? cats.sort((a, b) => a.sortOrder - b.sortOrder)[0]).id
}
