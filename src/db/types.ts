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
  /** set when this expense was logged by paying an installment */
  planPaymentId?: string | null
  createdAt: number
  updatedAt: number
}

/** Relative to *this* device — "you" is whoever holds the phone. */
export type TabParty = 'you' | 'partner'

/**
 * Absolute identity, fixed per build variant (Blossom = 'her', Midnight =
 * 'him'). `TabParty` is relative and must never go over the wire; `Side` is what
 * the two phones agree on. See `src/sync/side.ts`.
 */
export type Side = 'her' | 'him'

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
  /** which phone typed this in; undefined on rows written before sync existed */
  authorSide?: Side
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
  authorSide?: Side
  createdAt: number
  updatedAt: number
}

/**
 * Remembers that a tab row was deleted here, so the other phone re-publishing
 * its copy can't resurrect it. Pruned once both sides have certainly converged.
 */
export interface TabTombstone {
  /** `${kind}:${recordId}` — entries and settlements can't collide */
  id: string
  kind: 'entry' | 'settle'
  recordId: string
  deletedAt: number
}

/** Shared-tab sync pairing + cursor. Single row; absent means "not paired". */
export interface SyncState {
  id: 'sync'
  /** the secret gist holding both sides' encrypted ledger files */
  gistId: string
  /** GitHub PAT, `gist` scope only — never leaves the device except to GitHub */
  token: string
  /** base64url AES-GCM key; the server only ever sees ciphertext */
  key: string
  /** ETag of the last read, so polling costs no rate limit (304s are free) */
  etag: string | null
  /** hash of the slice we last uploaded, to skip no-op pushes */
  pushedHash: string | null
  lastPulledAt: number | null
  lastPushedAt: number | null
  lastError: string | null
  pairedAt: number
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

/* ----------------------------- installments ----------------------------- */

/**
 * How a plan is paid off:
 *   'fixed' — a set number of installments on set dates (a purchase on terms)
 *   'open'  — a total owed with no schedule at all, paid whenever suits
 */
export type PlanKind = 'fixed' | 'open'

/**
 * A fixed amount being paid off over time — a bill spread into installments, or
 * something bought on terms. Unlike `Recurring` this has an end: it is a debt
 * that shrinks, so what matters is how much is left, not what it costs a month.
 */
export interface Plan {
  id: string
  /** what it's for, e.g. "Heating bill 2025" */
  name: string
  total: number // cents — the whole amount owed
  categoryId: string | null
  /** missing on rows written before open plans existed, so treat as 'fixed' */
  kind?: PlanKind
  /** how many scheduled installments the total is split into ('fixed' only) */
  count: number
  /** one installment every `everyCount` `everyUnit`s ('fixed' only) */
  everyCount: number
  everyUnit: RecurUnit
  /** when the first installment is due; for 'open' plans, when it started */
  startDate: DateStr
  note: string
  createdAt: number
  updatedAt: number
}

/** Money actually handed over against a plan. */
export interface PlanPayment {
  id: string
  planId: string
  amount: number // cents
  paidOn: DateStr
  /** the expense this logged, so the money shows in the rest of the app */
  expenseId: string | null
  note: string
  createdAt: number
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
  /**
   * When a shared expense arrives from the other phone, also log your own share
   * as an expense here (so History/Budgets see it and the dashboard's cash view
   * stays correct). Off = the entry only moves the tab.
   */
  tabAutoLogShare: boolean
  /**
   * What was actually in the account at the start of `balanceAnchor`, in cents
   * (may be negative). The running balance on the dashboard counts forward from
   * there, so money left over — or overdrawn — carries from month to month
   * instead of every month starting from zero.
   */
  startingBalance: number
  /**
   * "YYYY-MM" the starting balance applies to. null = count from the first month
   * that has any data, which is the right default before it's ever been set.
   */
  balanceAnchor: string | null
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
  tabAutoLogShare: true,
  startingBalance: 0,
  balanceAnchor: null,
  seeded: false,
  lastBackupAt: null,
}
