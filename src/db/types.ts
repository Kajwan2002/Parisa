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
  /** set when this expense is the "your share" of a shared (split) expense */
  tabEntryId?: string | null
  createdAt: number
  updatedAt: number
}

export type TabParty = 'you' | 'partner'

/** One shared purchase that created a debt between the two of you. */
export interface TabEntry {
  id: string
  total: number // cents — the whole bill
  yourShare: number // cents — what you consumed
  partnerShare: number // cents — what the partner consumed
  paidBy: TabParty
  categoryId: string | null
  note: string
  date: DateStr
  /** the linked consumption Expense for `yourShare` (null when yourShare is 0) */
  expenseId: string | null
  createdAt: number
  updatedAt: number
}

/** A repayment between the two of you. Reduces the net tab; picks no entries. */
export interface TabSettlement {
  id: string
  amount: number // cents
  by: TabParty // who handed over the money
  date: DateStr
  note: string
  createdAt: number
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
  /** accent hex within the build's theme; '' → the theme's first accent */
  themeAccent: string
  /** name of the person you share a tab with; '' → shown as "Partner" */
  partnerName: string
  seeded: boolean
  lastBackupAt: number | null
  createdAt: number
}

export const DEFAULT_SETTINGS: Omit<Settings, 'createdAt'> = {
  id: 'app',
  currency: 'EUR',
  monthStartDay: 1,
  overallMonthlyBudget: null,
  themeAccent: '',
  partnerName: '',
  seeded: false,
  lastBackupAt: null,
}
