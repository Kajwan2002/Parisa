import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/color'
import { shortDate, todayStr } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useCategoryMap, usePlan, useSettings } from '@/db/queries'
import {
  addPlanPayment,
  deletePlan,
  deletePlanPayment,
  describePlanInterval,
  updatePlan,
  type Installment,
} from '@/db/plans'
import { cheer } from '@/theme/apply'
import { PlanForm } from './PlanForm'

export function PlanDetailPage() {
  const { planId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const view = usePlan(planId)
  const settings = useSettings()
  const catMap = useCategoryMap()
  const currency = settings?.currency ?? 'EUR'

  const [paying, setPaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [undoPayment, setUndoPayment] = useState<string | null>(null)

  if (view === undefined) {
    return (
      <Screen title="Plan" back="/plans">
        <div className="h-56 animate-pulse rounded-3xl bg-surface/60" />
      </Screen>
    )
  }
  if (view === null) {
    return (
      <Screen title="Plan" back="/plans">
        <Card>
          <p className="text-sm font-semibold text-ink-soft">This plan no longer exists.</p>
        </Card>
      </Screen>
    )
  }

  const { plan, kind, paid, remaining, progress, installments, nextDue, payments, isComplete } =
    view
  const openEnded = kind === 'open'
  const category = plan.categoryId ? (catMap?.get(plan.categoryId) ?? null) : null
  const money = (c: number) => formatMoney(c, currency, { compact: true })
  const paidCount = installments.filter((i) => i.status === 'paid').length
  // track a faded version of the fill, so the unpaid part never reads as paid
  const ringColor = category?.color ?? '#e7a4c0'
  // prefill what the schedule says is due; an open plan has no expected amount,
  // so it starts blank rather than making you clear the whole balance
  const suggested = nextDue ? nextDue.amount - nextDue.paid : 0

  return (
    <Screen
      title={plan.name}
      subtitle={
        openEnded
          ? `${money(plan.total)} · pay anytime`
          : `${money(plan.total)} · ${plan.count}× ${describePlanInterval(
              plan.everyCount,
              plan.everyUnit,
            )}`
      }
      back="/plans"
      right={
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink-soft shadow-card active:scale-95"
        >
          Edit
        </button>
      }
    >
      <Card className="flex flex-col items-center gap-3 py-6">
        <Ring
          value={progress}
          size={200}
          stroke={20}
          color={ringColor}
          trackColor={withAlpha(ringColor, 0.22)}
        >
          <div>
            <p className="text-xs font-bold text-ink-soft">
              {isComplete ? 'all paid' : 'still to pay'}
            </p>
            <p className="text-[2rem] leading-tight font-extrabold text-ink tabular-nums">
              {money(isComplete ? plan.total : remaining)}
            </p>
            <p className="text-xs font-semibold text-ink-faint">
              {openEnded
                ? `${Math.round(progress * 100)}% paid off`
                : `${paidCount} of ${plan.count} paid`}
            </p>
          </div>
        </Ring>

        <div className="flex w-full justify-around text-center">
          <Stat label="paid" value={money(paid)} />
          <Stat label="left" value={money(remaining)} />
          {openEnded ? (
            <Stat
              label={payments.length === 1 ? 'payment' : 'payments'}
              value={String(payments.length)}
            />
          ) : (
            <Stat
              label={nextDue ? (nextDue.overdue ? 'overdue' : 'next due') : 'done'}
              value={nextDue ? shortDate(nextDue.dueOn) : '—'}
              danger={!!nextDue?.overdue}
            />
          )}
        </div>

        {!isComplete && (
          <Button full onClick={() => setPaying(true)}>
            Record a payment
          </Button>
        )}
      </Card>

      {!openEnded && (
        <section>
          <SectionTitle>Schedule</SectionTitle>
          <Card className="mt-1 py-1">
            {installments.map((inst, i) => (
              <InstallmentRow key={inst.number} inst={inst} currency={currency} first={i === 0} />
            ))}
          </Card>
        </section>
      )}

      {openEnded && payments.length === 0 && (
        <Card>
          <p className="text-sm text-ink-soft">
            Nothing paid yet. There are no due dates on this one — record a payment whenever you
            put money towards it.
          </p>
        </Card>
      )}

      {payments.length > 0 && (
        <section>
          <SectionTitle>Payments</SectionTitle>
          <div className="mt-1 flex flex-col gap-2">
            {payments.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setUndoPayment(p.id)}
                className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-mint/30 text-base">
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{shortDate(p.paidOn)}</p>
                  {p.note && (
                    <p className="truncate text-xs font-semibold text-ink-faint">{p.note}</p>
                  )}
                </div>
                <span className="shrink-0 font-extrabold text-good tabular-nums">
                  {money(p.amount)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
        Delete this plan
      </Button>

      {/* record a payment */}
      <PaymentSheet
        open={paying}
        onClose={() => setPaying(false)}
        suggested={suggested}
        currency={currency}
        onSubmit={async (amount, paidOn, note) => {
          await addPlanPayment(plan.id, { amount, paidOn, note })
          setPaying(false)
          toast(cheer('Payment recorded 💕'))
        }}
      />

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit plan">
        <PlanForm
          initial={plan}
          currency={currency}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await updatePlan(plan.id, input)
            setEditing(false)
            toast('Plan updated')
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={undoPayment !== null}
        title="Undo this payment?"
        message="It will be removed from the plan and the expense it logged will be deleted too."
        confirmLabel="Undo payment"
        danger
        onConfirm={async () => {
          if (undoPayment) await deletePlanPayment(undoPayment)
          setUndoPayment(null)
          toast('Payment removed')
        }}
        onCancel={() => setUndoPayment(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this plan?"
        message="The plan and its payment record go away. Expenses already logged stay in your history."
        confirmLabel="Delete plan"
        danger
        onConfirm={async () => {
          await deletePlan(plan.id)
          setConfirmDelete(false)
          navigate('/plans')
          toast('Plan deleted')
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          'font-extrabold tabular-nums',
          danger ? 'text-over' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-ink-faint">{label}</p>
    </div>
  )
}

function InstallmentRow({
  inst,
  currency,
  first,
}: {
  inst: Installment
  currency: string
  first: boolean
}) {
  const money = (c: number) => formatMoney(c, currency, { compact: true })
  const partial = inst.status !== 'paid' && inst.paid > 0

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={first ? undefined : { borderTop: '1px solid var(--color-surface-2)' }}
    >
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold',
          inst.status === 'paid'
            ? 'bg-good/20 text-good'
            : inst.overdue
              ? 'bg-over/20 text-over'
              : 'bg-blush/60 text-ink-soft',
        )}
      >
        {inst.status === 'paid' ? '✓' : inst.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {inst.status === 'paid' && inst.settledOn
            ? `Paid ${shortDate(inst.settledOn)}`
            : shortDate(inst.dueOn)}
        </p>
        <p
          className={cn(
            'truncate text-xs font-semibold',
            inst.overdue ? 'text-over' : 'text-ink-faint',
          )}
        >
          {inst.status === 'paid'
            ? `was due ${shortDate(inst.dueOn)}`
            : inst.overdue
              ? partial
                ? `overdue · ${money(inst.paid)} of ${money(inst.amount)} paid`
                : 'overdue'
              : partial
                ? `${money(inst.paid)} of ${money(inst.amount)} paid`
                : 'upcoming'}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 font-extrabold tabular-nums',
          inst.status === 'paid' ? 'text-ink-faint' : 'text-ink',
        )}
      >
        {money(inst.amount)}
      </span>
    </div>
  )
}

function PaymentSheet({
  open,
  onClose,
  suggested,
  currency,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  suggested: number
  currency: string
  onSubmit: (amount: number, paidOn: string, note: string) => void
}) {
  const [amount, setAmount] = useState(suggested)
  const [paidOn, setPaidOn] = useState(todayStr())
  const [note, setNote] = useState('')
  const [seeded, setSeeded] = useState(false)

  // prefill with what's actually due, but let an edit stand
  if (open && !seeded) {
    setSeeded(true)
    setAmount(suggested)
    setPaidOn(todayStr())
    setNote('')
  }
  if (!open && seeded) setSeeded(false)

  return (
    <Sheet open={open} onClose={onClose} title="Record a payment">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (amount <= 0) return
          onSubmit(amount, paidOn, note)
        }}
      >
        <MoneyKeypad cents={amount} onChange={setAmount} currency={currency} />

        <label>
          <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Paid on</span>
          <input
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none focus:ring-2 focus:ring-rose-soft"
          />
        </label>

        <label>
          <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. paid by transfer"
            className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
          />
        </label>

        <p className="px-1 text-xs font-semibold text-ink-faint">
          This also logs an expense for the day you paid, so it shows up on your dashboard and in
          History.
        </p>

        <Button type="submit" full disabled={amount <= 0}>
          Record payment
        </Button>
      </form>
    </Sheet>
  )
}
