import type { DateStr } from '@/lib/dates'

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  /** optional monthly budget for this category, in cents */
  monthlyBudget: number | null
  sortOrder: number
  isArchived: boolean
  /** seeded on first run — only affects nothing, purely informational */
  isDefault: boolean
  createdAt: number
}

export interface Expense {
  id: string
  amount: number // cents, always positive
  categoryId: string | null
  note: string
  spentOn: DateStr
  /** set when this expense was auto-created by a recurring payment rule */
  recurringId?: string | null
  createdAt: number
  updatedAt: number
}

export type RecurUnit = 'week' | 'month'

export interface Recurring {
  id: string
  amount: number // cents
  categoryId: string | null
  note: string
  /** repeats every `everyCount` `everyUnit`s (e.g. 6 months) */
  everyCount: number
  everyUnit: RecurUnit
  /** date of the first payment; also the anchor for the repeat day */
  anchorDate: DateStr
  /** optional last date; null = forever */
  endDate: DateStr | null
  isActive: boolean
  /** high-water mark: the latest occurrence already turned into an expense */
  lastChargedOn: DateStr | null
  createdAt: number
  updatedAt: number
}

export type IncomeSource = string // "Salary" | "Parents" | "Gift" | custom

export interface Income {
  id: string
  amount: number // cents
  source: IncomeSource
  receivedOn: DateStr
  /** if true, this amount is assumed to arrive every month */
  recurringMonthly: boolean
  note: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  id: 'app' // single row
  currency: string
  monthStartDay: number
  overallMonthlyBudget: number | null // cents
  themeAccent: string
  seeded: boolean
  lastBackupAt: number | null
  createdAt: number
}

export const DEFAULT_SETTINGS: Omit<Settings, 'createdAt'> = {
  id: 'app',
  currency: 'EUR',
  monthStartDay: 1,
  overallMonthlyBudget: null,
  themeAccent: '#ec7fa9',
  seeded: false,
  lastBackupAt: null,
}
