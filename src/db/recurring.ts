import { addMonths, addWeeks, format, parseISO } from 'date-fns'
import { newId } from '@/lib/id'
import { todayStr, type DateStr } from '@/lib/dates'
import { db } from './db'
import type { RecurUnit, Recurring } from './types'

/* --------------------------- occurrence maths --------------------------- */

function occurrenceDate(rule: Pick<Recurring, 'anchorDate' | 'everyUnit' | 'everyCount'>, k: number): DateStr {
  const base = parseISO(rule.anchorDate + 'T00:00:00')
  const step = rule.everyCount * k
  const d = rule.everyUnit === 'week' ? addWeeks(base, step) : addMonths(base, step)
  return format(d, 'yyyy-MM-dd')
}

/** the next payment date strictly after today (or null if the rule has ended) */
export function nextChargeDate(rule: Recurring): DateStr | null {
  const today = todayStr()
  for (let k = 0; k < 5000; k++) {
    const occ = occurrenceDate(rule, k)
    if (rule.endDate && occ > rule.endDate) return null
    if (occ > today) return occ
  }
  return null
}

/** amount normalised to a per-month figure, for "≈ €X / month" totals */
export function monthlyEquivalent(rule: Pick<Recurring, 'amount' | 'everyUnit' | 'everyCount'>): number {
  if (rule.everyUnit === 'week') return (rule.amount * (52 / 12)) / rule.everyCount
  return rule.amount / rule.everyCount
}

export function describeInterval(everyCount: number, everyUnit: RecurUnit): string {
  if (everyCount === 1) return everyUnit === 'week' ? 'Every week' : 'Every month'
  return `Every ${everyCount} ${everyUnit}s`
}

/* ------------------------------- CRUD ------------------------------- */

export interface RecurringInput {
  amount: number
  categoryId: string | null
  note: string
  everyCount: number
  everyUnit: RecurUnit
  anchorDate: DateStr
  endDate: DateStr | null
}

export async function addRecurring(input: RecurringInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.recurring.add({
    id,
    amount: Math.max(0, Math.round(input.amount)),
    categoryId: input.categoryId,
    note: input.note.trim(),
    everyCount: Math.max(1, Math.round(input.everyCount)),
    everyUnit: input.everyUnit,
    anchorDate: input.anchorDate,
    endDate: input.endDate,
    isActive: true,
    lastChargedOn: null,
    createdAt: now,
    updatedAt: now,
  })
  await materializeRecurring()
  return id
}

export async function updateRecurring(id: string, patch: Partial<RecurringInput & { isActive: boolean }>): Promise<void> {
  const clean: Partial<Recurring> = { ...patch, updatedAt: Date.now() }
  if (clean.amount != null) clean.amount = Math.max(0, Math.round(clean.amount))
  if (clean.note != null) clean.note = clean.note.trim()
  if (clean.everyCount != null) clean.everyCount = Math.max(1, Math.round(clean.everyCount))
  await db.recurring.update(id, clean)
  await materializeRecurring()
}

/**
 * Pause / resume a rule. Resuming skips the paused gap: it only logs payments
 * from today onward, never back-fills the time it was paused.
 */
export async function setRecurringActive(id: string, isActive: boolean): Promise<void> {
  const patch: Partial<Recurring> = { isActive, updatedAt: Date.now() }
  if (isActive) patch.lastChargedOn = todayStr()
  await db.recurring.update(id, patch)
  if (isActive) await materializeRecurring()
}

/** Delete a rule. Already-logged payments stay in the history. */
export async function deleteRecurring(id: string): Promise<void> {
  await db.recurring.delete(id)
}

/* --------------------------- materialisation --------------------------- */

let running = false

/**
 * Turns every due-but-not-yet-logged occurrence of each active recurring rule
 * into a normal expense, dated on the day it was charged. Safe to call often:
 * it only ever moves forward (uses `lastChargedOn` as a high-water mark), so a
 * payment you delete by hand will not reappear.
 */
export async function materializeRecurring(): Promise<number> {
  if (running) return 0
  running = true
  try {
    const today = todayStr()
    const rules = await db.recurring.toArray()
    let created = 0

    for (const rule of rules) {
      if (!rule.isActive) continue

      const cursor = rule.lastChargedOn
      const due: DateStr[] = []
      let latest = cursor

      for (let k = 0; k < 5000; k++) {
        const occ = occurrenceDate(rule, k)
        if (occ > today) break
        if (rule.endDate && occ > rule.endDate) break
        if (cursor && occ <= cursor) continue
        due.push(occ)
        latest = occ
      }

      if (due.length === 0) continue

      const now = Date.now()
      await db.transaction('rw', db.expenses, db.recurring, async () => {
        await db.expenses.bulkAdd(
          due.map((spentOn) => ({
            id: newId(),
            amount: rule.amount,
            categoryId: rule.categoryId,
            note: rule.note,
            spentOn,
            recurringId: rule.id,
            createdAt: now,
            updatedAt: now,
          })),
        )
        await db.recurring.update(rule.id, { lastChargedOn: latest, updatedAt: now })
      })
      created += due.length
    }

    return created
  } finally {
    running = false
  }
}
