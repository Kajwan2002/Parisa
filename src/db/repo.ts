import { newId } from '@/lib/id'
import { db } from './db'
import { fallbackCategoryId } from './seed'
import { DEFAULT_SETTINGS, type Category, type Expense, type Income, type Settings } from './types'

/* ------------------------------- settings ------------------------------- */

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app')
  return s ?? { ...DEFAULT_SETTINGS, createdAt: Date.now() }
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'app' })
}

/* ------------------------------ categories ------------------------------ */

export interface CategoryInput {
  name: string
  emoji: string
  color: string
  monthlyBudget?: number | null
}

export async function addCategory(input: CategoryInput): Promise<string> {
  const count = await db.categories.count()
  const id = newId()
  await db.categories.add({
    id,
    name: input.name.trim(),
    emoji: input.emoji,
    color: input.color,
    monthlyBudget: input.monthlyBudget ?? null,
    sortOrder: count,
    isArchived: false,
    isDefault: false,
    createdAt: Date.now(),
  })
  return id
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'emoji' | 'color' | 'monthlyBudget'>>,
): Promise<void> {
  const clean = { ...patch }
  if (clean.name != null) clean.name = clean.name.trim()
  await db.categories.update(id, clean)
}

/**
 * Delete a category. `reassign` moves its expenses to the fallback ("Other")
 * category; `keep` leaves the expenses but uncategorised.
 */
export async function deleteCategory(id: string, mode: 'reassign' | 'keep'): Promise<void> {
  await db.transaction('rw', db.categories, db.expenses, async () => {
    if (mode === 'reassign') {
      const target = await fallbackCategoryId(id)
      await db.expenses.where('categoryId').equals(id).modify({ categoryId: target })
    } else {
      await db.expenses.where('categoryId').equals(id).modify({ categoryId: null })
    }
    await db.categories.delete(id)
  })
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    await Promise.all(orderedIds.map((id, i) => db.categories.update(id, { sortOrder: i })))
  })
}

/* ------------------------------- expenses ------------------------------- */

export interface ExpenseInput {
  amount: number // cents
  categoryId: string | null
  note: string
  spentOn: string
}

export async function addExpense(input: ExpenseInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.expenses.add({
    id,
    amount: Math.max(0, Math.round(input.amount)),
    categoryId: input.categoryId,
    note: input.note.trim(),
    spentOn: input.spentOn,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<void> {
  const clean: Partial<Expense> = { ...patch, updatedAt: Date.now() }
  if (clean.amount != null) clean.amount = Math.max(0, Math.round(clean.amount))
  if (clean.note != null) clean.note = clean.note.trim()
  await db.expenses.update(id, clean)
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.delete(id)
}

/* -------------------------------- income -------------------------------- */

export interface IncomeInput {
  amount: number
  source: string
  receivedOn: string
  recurringMonthly: boolean
  note: string
}

export async function addIncome(input: IncomeInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.income.add({
    id,
    amount: Math.max(0, Math.round(input.amount)),
    source: input.source.trim() || 'Income',
    receivedOn: input.receivedOn,
    recurringMonthly: input.recurringMonthly,
    note: input.note.trim(),
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateIncome(id: string, patch: Partial<IncomeInput>): Promise<void> {
  const clean: Partial<Income> = { ...patch, updatedAt: Date.now() }
  if (clean.amount != null) clean.amount = Math.max(0, Math.round(clean.amount))
  if (clean.source != null) clean.source = clean.source.trim() || 'Income'
  if (clean.note != null) clean.note = clean.note.trim()
  await db.income.update(id, clean)
}

export async function deleteIncome(id: string): Promise<void> {
  await db.income.delete(id)
}
