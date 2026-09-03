import { useLiveQuery } from 'dexie-react-hooks'
import {
  currentMonthKey,
  elapsedDaysInMonth,
  monthKeyOf,
  monthsOfYear,
  shiftMonth,
  type MonthKey,
  type YearKey,
} from '@/lib/dates'
import { db } from './db'
import { getSettings } from './repo'
import type { Category, Expense, Income, Recurring, Settings } from './types'

/* ------------------------------ basic lists ----------------------------- */

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

/** active categories, in display order */
export function useCategories(): Category[] | undefined {
  return useLiveQuery(
    () => db.categories.filter((c) => !c.isArchived).sortBy('sortOrder'),
    [],
  )
}

export function useCategoryMap(): Map<string, Category> | undefined {
  return useLiveQuery(async () => {
    const all = await db.categories.toArray()
    return new Map(all.map((c) => [c.id, c]))
  }, [])
}

export function useExpense(id: string | null): Expense | undefined {
  return useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id])
}

export function useRecurring(): Recurring[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.recurring.toArray()
    return all.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.note.localeCompare(b.note))
  }, [])
}

/* ---------------------------- month aggregates -------------------------- */

export interface CategorySpend {
  category: Category | null
  categoryId: string | null
  spent: number
  budget: number | null
  share: number // 0..1 of month total
}

export interface MonthSummary {
  monthKey: MonthKey
  spent: number
  income: number
  overallBudget: number | null
  /** budget - spent (or income - spent when no budget); can be negative */
  leftToSpend: number | null
  byCategory: CategorySpend[]
  expenseCount: number
  perDay: number
}

export function incomeForMonth(all: Income[], monthKey: MonthKey): number {
  return all.reduce((sum, i) => {
    const k = monthKeyOf(i.receivedOn)
    if (i.recurringMonthly ? k <= monthKey : k === monthKey) return sum + i.amount
    return sum
  }, 0)
}

async function computeMonthSummary(monthKey: MonthKey): Promise<MonthSummary> {
  const [expenses, categories, incomeRows, settings] = await Promise.all([
    db.expenses.where('spentOn').startsWith(monthKey).toArray(),
    db.categories.toArray(),
    db.income.toArray(),
    getSettings(),
  ])
  const catById = new Map(categories.map((c) => [c.id, c]))

  const spent = sum(expenses.map((e) => e.amount))
  const income = incomeForMonth(incomeRows, monthKey)

  const spendByCat = new Map<string | null, number>()
  for (const e of expenses) {
    spendByCat.set(e.categoryId, (spendByCat.get(e.categoryId) ?? 0) + e.amount)
  }

  const byCategory: CategorySpend[] = [...spendByCat.entries()]
    .map(([categoryId, amt]) => {
      const category = categoryId ? (catById.get(categoryId) ?? null) : null
      return {
        category,
        categoryId,
        spent: amt,
        budget: category?.monthlyBudget ?? null,
        share: spent > 0 ? amt / spent : 0,
      }
    })
    .sort((a, b) => b.spent - a.spent)

  const overallBudget = settings.overallMonthlyBudget
  const leftToSpend =
    overallBudget != null ? overallBudget - spent : income > 0 ? income - spent : null

  return {
    monthKey,
    spent,
    income,
    overallBudget,
    leftToSpend,
    byCategory,
    expenseCount: expenses.length,
    perDay: spent / Math.max(1, elapsedDaysInMonth(monthKey)),
  }
}

export function useMonthSummary(monthKey: MonthKey): MonthSummary | undefined {
  return useLiveQuery(() => computeMonthSummary(monthKey), [monthKey])
}

export function useMonthExpenses(monthKey: MonthKey): Expense[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.expenses.where('spentOn').startsWith(monthKey).toArray()
    return rows.sort(
      (a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt - a.createdAt,
    )
  }, [monthKey])
}

export function useMonthIncome(monthKey: MonthKey): Income[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.income.toArray()
    return all
      .filter((i) =>
        i.recurringMonthly
          ? monthKeyOf(i.receivedOn) <= monthKey
          : monthKeyOf(i.receivedOn) === monthKey,
      )
      .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))
  }, [monthKey])
}

/* ----------------------------- year aggregates ------------------------- */

export interface YearSummary {
  yearKey: YearKey
  total: number
  income: number
  monthly: { monthKey: MonthKey; spent: number }[]
  byCategory: { category: Category | null; spent: number; share: number }[]
  activeMonths: number
  average: number
}

async function computeYearSummary(yearKey: YearKey): Promise<YearSummary> {
  const [expenses, categories, incomeRows] = await Promise.all([
    db.expenses.where('spentOn').startsWith(yearKey).toArray(),
    db.categories.toArray(),
    db.income.toArray(),
  ])
  const catById = new Map(categories.map((c) => [c.id, c]))
  const months = monthsOfYear(yearKey)

  const monthly = months.map((monthKey) => ({
    monthKey,
    spent: sum(expenses.filter((e) => monthKeyOf(e.spentOn) === monthKey).map((e) => e.amount)),
  }))
  const total = sum(monthly.map((m) => m.spent))
  const income = sum(months.map((m) => incomeForMonth(incomeRows, m)))

  const byCatMap = new Map<string | null, number>()
  for (const e of expenses) byCatMap.set(e.categoryId, (byCatMap.get(e.categoryId) ?? 0) + e.amount)
  const byCategory = [...byCatMap.entries()]
    .map(([id, amt]) => ({
      category: id ? (catById.get(id) ?? null) : null,
      spent: amt,
      share: total > 0 ? amt / total : 0,
    }))
    .sort((a, b) => b.spent - a.spent)

  const nowMonth = currentMonthKey()
  const activeMonths = monthly.filter(
    (m) => m.spent > 0 || (m.monthKey <= nowMonth && m.monthKey.startsWith(yearKey)),
  ).length

  return {
    yearKey,
    total,
    income,
    monthly,
    byCategory,
    activeMonths: Math.max(1, activeMonths),
    average: total / Math.max(1, activeMonths),
  }
}

export function useYearSummary(yearKey: YearKey): YearSummary | undefined {
  return useLiveQuery(() => computeYearSummary(yearKey), [yearKey])
}

/* ------------------------------- insights ------------------------------ */

export interface Insights {
  monthKey: MonthKey
  spent: number
  prevSpent: number
  deltaPct: number | null
  income: number
  incomeUsedPct: number | null
  topCategories: { category: Category | null; spent: number }[]
  biggest: Expense | null
  perDay: number
  savedSoFar: number | null
}

async function computeInsights(monthKey: MonthKey): Promise<Insights> {
  const prevKey = shiftMonth(monthKey, -1)
  const [cur, prev] = await Promise.all([
    computeMonthSummary(monthKey),
    computeMonthSummary(prevKey),
  ])
  const expenses = await db.expenses.where('spentOn').startsWith(monthKey).toArray()
  const biggest = expenses.sort((a, b) => b.amount - a.amount)[0] ?? null

  const deltaPct = prev.spent > 0 ? ((cur.spent - prev.spent) / prev.spent) * 100 : null

  return {
    monthKey,
    spent: cur.spent,
    prevSpent: prev.spent,
    deltaPct,
    income: cur.income,
    incomeUsedPct: cur.income > 0 ? (cur.spent / cur.income) * 100 : null,
    topCategories: cur.byCategory.slice(0, 3).map((c) => ({ category: c.category, spent: c.spent })),
    biggest,
    perDay: cur.perDay,
    savedSoFar: cur.income > 0 ? cur.income - cur.spent : null,
  }
}

export function useInsights(monthKey: MonthKey): Insights | undefined {
  return useLiveQuery(() => computeInsights(monthKey), [monthKey])
}

/* -------------------------------- utils -------------------------------- */

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
