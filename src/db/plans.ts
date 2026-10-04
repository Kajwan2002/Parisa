import { addMonths, addWeeks, format, parseISO } from 'date-fns'
import { newId } from '@/lib/id'
import { todayStr, type DateStr } from '@/lib/dates'
import { db } from './db'
import type { Plan, PlanKind, PlanPayment, RecurUnit } from './types'

/* ------------------------------ the schedule ----------------------------- */

/**
 * Split a total into whole-cent installments. Every installment is the same
 * except the last, which absorbs the rounding so the parts always add back up
 * to exactly the total.
 */
export function installmentAmounts(total: number, count: number): number[] {
  const n = Math.max(1, Math.round(count))
  const whole = Math.max(0, Math.round(total))
  const base = Math.floor(whole / n)
  const amounts = new Array<number>(n).fill(base)
  amounts[n - 1] = whole - base * (n - 1)
  return amounts
}

export function installmentDate(
  plan: Pick<Plan, 'startDate' | 'everyUnit' | 'everyCount'>,
  index: number,
): DateStr {
  const base = parseISO(plan.startDate + 'T00:00:00')
  const step = plan.everyCount * index
  const d = plan.everyUnit === 'week' ? addWeeks(base, step) : addMonths(base, step)
  return format(d, 'yyyy-MM-dd')
}

export function describePlanInterval(everyCount: number, everyUnit: RecurUnit): string {
  if (everyCount === 1) return everyUnit === 'week' ? 'weekly' : 'monthly'
  return `every ${everyCount} ${everyUnit}s`
}

export type InstallmentStatus = 'paid' | 'due' | 'upcoming'

export interface Installment {
  /** 1-based, as a person would count them */
  number: number
  dueOn: DateStr
  amount: number
  /** how much of this installment is covered */
  paid: number
  status: InstallmentStatus
  /** when it was fully covered, if it is */
  settledOn: DateStr | null
  overdue: boolean
}

export function planKind(plan: Pick<Plan, 'kind'>): PlanKind {
  return plan.kind === 'open' ? 'open' : 'fixed'
}

export interface PlanView {
  plan: Plan
  kind: PlanKind
  payments: PlanPayment[]
  paid: number
  remaining: number
  /** 0..1, capped — overpaying shows as a full ring, not more than full */
  progress: number
  installments: Installment[]
  /** the first installment not yet fully covered */
  nextDue: Installment | null
  overdueCount: number
  overdueAmount: number
  isComplete: boolean
}

/**
 * Work out where a plan stands. Payments are applied to installments in order,
 * oldest first, so paying a lump sum settles several at once and paying part of
 * one leaves the rest of it outstanding — which is how people actually think
 * about chipping away at a bill.
 */
export function buildPlanView(plan: Plan, allPayments: PlanPayment[]): PlanView {
  const payments = allPayments
    .filter((p) => p.planId === plan.id)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.createdAt - b.createdAt)

  const today = todayStr()
  const paidTotal = payments.reduce((n, p) => n + p.amount, 0)
  const remainingTotal = Math.max(0, plan.total - paidTotal)

  // An open plan has no schedule to track against — there is nothing that can be
  // due, so nothing that can be late. It is just a total shrinking as you pay.
  if (planKind(plan) === 'open') {
    return {
      plan,
      kind: 'open',
      payments: [...payments].reverse(),
      paid: paidTotal,
      remaining: remainingTotal,
      progress: plan.total > 0 ? Math.min(1, paidTotal / plan.total) : 0,
      installments: [],
      nextDue: null,
      overdueCount: 0,
      overdueAmount: 0,
      isComplete: remainingTotal <= 0,
    }
  }

  const amounts = installmentAmounts(plan.total, plan.count)
  const installments: Installment[] = amounts.map((amount, i) => ({
    number: i + 1,
    dueOn: installmentDate(plan, i),
    amount,
    paid: 0,
    status: 'upcoming',
    settledOn: null,
    overdue: false,
  }))

  // spread the payments across the schedule, oldest first
  let pi = 0
  let left = payments[0]?.amount ?? 0
  for (const inst of installments) {
    while (inst.paid < inst.amount && pi < payments.length) {
      if (left <= 0) {
        pi++
        left = payments[pi]?.amount ?? 0
        continue
      }
      const take = Math.min(inst.amount - inst.paid, left)
      inst.paid += take
      left -= take
      if (inst.paid >= inst.amount) inst.settledOn = payments[pi].paidOn
    }
  }

  for (const inst of installments) {
    if (inst.paid >= inst.amount) inst.status = 'paid'
    else if (inst.dueOn <= today) {
      inst.status = 'due'
      inst.overdue = true
    } else inst.status = 'upcoming'
  }

  const paid = payments.reduce((n, p) => n + p.amount, 0)
  const remaining = Math.max(0, plan.total - paid)
  const outstanding = installments.filter((i) => i.status !== 'paid')

  return {
    plan,
    kind: 'fixed',
    payments: [...payments].reverse(), // newest first for display
    paid,
    remaining,
    progress: plan.total > 0 ? Math.min(1, paid / plan.total) : 0,
    installments,
    nextDue: outstanding[0] ?? null,
    overdueCount: outstanding.filter((i) => i.overdue).length,
    overdueAmount: outstanding
      .filter((i) => i.overdue)
      .reduce((n, i) => n + (i.amount - i.paid), 0),
    isComplete: remaining <= 0,
  }
}

/* --------------------------------- CRUD --------------------------------- */

export interface PlanInput {
  name: string
  total: number
  categoryId: string | null
  kind: PlanKind
  count: number
  everyCount: number
  everyUnit: RecurUnit
  startDate: DateStr
  note: string
}

function clean(input: PlanInput) {
  return {
    name: input.name.trim() || 'Installment plan',
    total: Math.max(0, Math.round(input.total)),
    categoryId: input.categoryId,
    kind: input.kind,
    count: Math.min(600, Math.max(1, Math.round(input.count))),
    everyCount: Math.max(1, Math.round(input.everyCount)),
    everyUnit: input.everyUnit,
    startDate: input.startDate,
    note: input.note.trim(),
  }
}

export async function addPlan(input: PlanInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.plans.add({ id, ...clean(input), createdAt: now, updatedAt: now })
  return id
}

export async function updatePlan(id: string, input: PlanInput): Promise<void> {
  await db.plans.update(id, { ...clean(input), updatedAt: Date.now() })
}

/** Delete a plan and its payments. Expenses already logged stay in the history. */
export async function deletePlan(id: string): Promise<void> {
  await db.transaction('rw', [db.plans, db.planPayments, db.expenses], async () => {
    const payments = await db.planPayments.where('planId').equals(id).toArray()
    for (const p of payments) {
      if (p.expenseId) await db.expenses.update(p.expenseId, { planPaymentId: null })
    }
    await db.planPayments.bulkDelete(payments.map((p) => p.id))
    await db.plans.delete(id)
  })
}

export interface PaymentInput {
  amount: number
  paidOn: DateStr
  note: string
}

/**
 * Record money paid against a plan. This also logs a normal expense for the day
 * it was paid, so the money leaving the account shows up on the dashboard and in
 * History like any other spending.
 */
export async function addPlanPayment(planId: string, input: PaymentInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  const amount = Math.max(0, Math.round(input.amount))

  await db.transaction('rw', [db.plans, db.planPayments, db.expenses], async () => {
    const plan = await db.plans.get(planId)
    if (!plan) throw new Error('That plan no longer exists.')

    const expenseId = newId()
    await db.expenses.add({
      id: expenseId,
      amount,
      categoryId: plan.categoryId,
      note: input.note.trim() || plan.name,
      spentOn: input.paidOn,
      planPaymentId: id,
      createdAt: now,
      updatedAt: now,
    })
    await db.planPayments.add({
      id,
      planId,
      amount,
      paidOn: input.paidOn,
      expenseId,
      note: input.note.trim(),
      createdAt: now,
    })
  })
  return id
}

/** Undo a payment, removing the expense it logged. */
export async function deletePlanPayment(id: string): Promise<void> {
  await db.transaction('rw', [db.planPayments, db.expenses], async () => {
    const payment = await db.planPayments.get(id)
    if (!payment) return
    if (payment.expenseId) await db.expenses.delete(payment.expenseId)
    await db.planPayments.delete(id)
  })
}

/** Drop a payment because the expense it logged was deleted by hand. */
export async function detachPlanPayment(paymentId: string): Promise<void> {
  await db.planPayments.delete(paymentId)
}
