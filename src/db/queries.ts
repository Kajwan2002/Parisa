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
import { THEME } from '@/theme/themes'
import { db } from './db'
import { getSettings } from './repo'
import type {
  Category,
  Expense,
  Income,
  Recurring,
  Settings,
  TabEntry,
  TabSettlement,
} from './types'

/* ------------------------------ basic lists ----------------------------- */

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

/** the build's fixed theme (kept as a hook so call sites stay uniform) */
export function useActiveTheme() {
  return THEME
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

export function useTabEntry(id: string | null): TabEntry | undefined {
  return useLiveQuery(() => (id ? db.tabEntries.get(id) : undefined), [id])
}

/* -------------------------------- shared tab -------------------------------- */

/** signed contribution of an entry to the net tab (+ = partner owes you) */
export function tabEntrySigned(e: TabEntry): number {
  return e.paidBy === 'you' ? e.partnerShare : -e.yourShare
}
export function tabSettlementSigned(s: TabSettlement): number {
  return s.by === 'you' ? s.amount : -s.amount
}

export interface TabEntryView extends TabEntry {
  clearedAmount: number
  outstanding: number // the debt this entry still represents
}

export interface TabSummary {
  net: number // + = partner owes you, − = you owe partner
  owedToYou: number
  owedByYou: number
  partnerName: string
  entries: TabEntryView[]
  settlements: TabSettlement[]
}

interface QueueItem {
  id: string
  remaining: number
  isEntry: boolean
}

async function computeTabSummary(): Promise<TabSummary> {
  const [entries, settlements, settings] = await Promise.all([
    db.tabEntries.toArray(),
    db.tabSettlements.toArray(),
    getSettings(),
  ])

  const net =
    entries.reduce((s, e) => s + tabEntrySigned(e), 0) +
    settlements.reduce((s, x) => s + tabSettlementSigned(x), 0)

  // one chronological pass: opposite items cancel each other (entries net
  // against opposite entries, settlements absorb their side). Display only.
  type Item =
    | { kind: 'entry'; id: string; date: string; createdAt: number; dir: 1 | -1; amt: number }
    | { kind: 'settle'; id: string; date: string; createdAt: number; dir: 1 | -1; amt: number }

  const items: Item[] = [
    ...entries.map((e) => ({
      kind: 'entry' as const,
      id: e.id,
      date: e.date,
      createdAt: e.createdAt,
      dir: (e.paidBy === 'you' ? 1 : -1) as 1 | -1,
      amt: e.paidBy === 'you' ? e.partnerShare : e.yourShare,
    })),
    ...settlements.map((x) => ({
      kind: 'settle' as const,
      id: x.id,
      date: x.date,
      createdAt: x.createdAt,
      dir: (x.by === 'you' ? 1 : -1) as 1 | -1,
      amt: x.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)

  const posQ: QueueItem[] = []
  const negQ: QueueItem[] = []
  const clearedById = new Map<string, number>()
  const bump = (id: string, n: number) => clearedById.set(id, (clearedById.get(id) ?? 0) + n)

  for (const it of items) {
    let x = it.amt
    const sameQ = it.dir > 0 ? posQ : negQ
    const oppQ = it.dir > 0 ? negQ : posQ
    while (x > 0 && oppQ.length > 0) {
      const head = oppQ[0]
      const used = Math.min(x, head.remaining)
      head.remaining -= used
      x -= used
      if (head.isEntry) bump(head.id, used)
      if (it.kind === 'entry') bump(it.id, used)
      if (head.remaining === 0) oppQ.shift()
    }
    if (x > 0) sameQ.push({ id: it.id, remaining: x, isEntry: it.kind === 'entry' })
  }

  const entryViews: TabEntryView[] = entries
    .map((e) => {
      const debt = e.paidBy === 'you' ? e.partnerShare : e.yourShare
      const cleared = Math.min(debt, clearedById.get(e.id) ?? 0)
      return { ...e, clearedAmount: cleared, outstanding: debt - cleared }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

  return {
    net,
    owedToYou: Math.max(0, net),
    owedByYou: Math.max(0, -net),
    partnerName: settings.partnerName,
    entries: entryViews,
    settlements: [...settlements].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    ),
  }
}

export function useTabSummary(): TabSummary | undefined {
  return useLiveQuery(() => computeTabSummary(), [])
}

/** whether the shared-tab feature has been used / set up at all */
export function useTabActive(): boolean | undefined {
  return useLiveQuery(async () => {
    const s = await getSettings()
    if (s.partnerName.trim()) return true
    const [entries, settlements] = await Promise.all([
      db.tabEntries.count(),
      db.tabSettlements.count(),
    ])
    return entries > 0 || settlements > 0
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

export interface DashboardSummary extends MonthSummary {
  /** net tab money moved this month: + = you paid out, − = partner paid you */
  settlementNet: number
}

/**
 * The dashboard's **cash view** of a month: like `computeMonthSummary` but every
 * figure reflects money actually in/out of your account, so it mirrors the bank.
 * Shared expenses count at the full amount you paid; the fronted / owed portion
 * lives on the tab instead. History/Insights/Budgets keep using the consumption
 * view above.
 */
async function computeDashboard(monthKey: MonthKey): Promise<DashboardSummary> {
  const [expenses, tabEntries, settlements, categories, incomeRows, settings] =
    await Promise.all([
      db.expenses.where('spentOn').startsWith(monthKey).toArray(),
      db.tabEntries.where('date').startsWith(monthKey).toArray(),
      db.tabSettlements.where('date').startsWith(monthKey).toArray(),
      db.categories.toArray(),
      db.income.toArray(),
      getSettings(),
    ])
  const catById = new Map(categories.map((c) => [c.id, c]))

  const consumption = sum(expenses.map((e) => e.amount))
  const fronted = sum(
    tabEntries.filter((t) => t.paidBy === 'you').map((t) => t.partnerShare),
  )
  const consumedUnpaid = sum(
    tabEntries.filter((t) => t.paidBy === 'partner').map((t) => t.yourShare),
  )
  const settledOut = sum(settlements.filter((s) => s.by === 'you').map((s) => s.amount))
  const settledIn = sum(settlements.filter((s) => s.by === 'partner').map((s) => s.amount))
  const cashSpent = consumption + fronted - consumedUnpaid + settledOut - settledIn

  const catCash = new Map<string | null, number>()
  const add = (k: string | null, v: number) => catCash.set(k, (catCash.get(k) ?? 0) + v)
  for (const e of expenses) add(e.categoryId, e.amount)
  for (const t of tabEntries) {
    if (t.paidBy === 'you') add(t.categoryId, t.partnerShare)
    else add(t.categoryId, -t.yourShare)
  }

  const byCategory: CategorySpend[] = [...catCash.entries()]
    .map(([categoryId, amt]) => {
      const category = categoryId ? (catById.get(categoryId) ?? null) : null
      return {
        category,
        categoryId,
        spent: Math.max(0, amt),
        budget: category?.monthlyBudget ?? null,
        share: 0,
      }
    })
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
  const catTotal = sum(byCategory.map((c) => c.spent))
  for (const c of byCategory) c.share = catTotal > 0 ? c.spent / catTotal : 0

  const income = incomeForMonth(incomeRows, monthKey)
  const overallBudget = settings.overallMonthlyBudget
  const leftToSpend =
    overallBudget != null ? overallBudget - cashSpent : income > 0 ? income - cashSpent : null

  return {
    monthKey,
    spent: cashSpent,
    income,
    overallBudget,
    leftToSpend,
    byCategory,
    expenseCount: expenses.length,
    perDay: Math.max(0, cashSpent) / Math.max(1, elapsedDaysInMonth(monthKey)),
    settlementNet: settledOut - settledIn,
  }
}

export function useDashboard(monthKey: MonthKey): DashboardSummary | undefined {
  return useLiveQuery(() => computeDashboard(monthKey), [monthKey])
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
