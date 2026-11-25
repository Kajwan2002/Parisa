import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { shortDate, todayStr } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useActiveTheme, useCategoryMap, usePlans, useSettings } from '@/db/queries'
import { allocateCardPayment, cardOutstanding, payCard, planSplitPct } from '@/db/plans'
import type { CardAllocation, PlanView } from '@/db/plans'
import { cheer } from '@/theme/apply'
import { PlanRow } from './PlanRow'

/** What a card owes in total, from the purchases sitting under it. */
export function cardTotals(members: PlanView[]) {
  const total = members.reduce((n, v) => n + v.plan.total, 0)
  const paid = members.reduce((n, v) => n + Math.min(v.paid, v.plan.total), 0)
  const remaining = members.reduce((n, v) => n + v.remaining, 0)
  const overdueCount = members.reduce((n, v) => n + v.overdueCount, 0)

  // what the card asks for on its next billing day: every purchase that still
  // has something outstanding contributes its next installment
  const dues = members.map((v) => v.nextDue).filter((d): d is NonNullable<typeof d> => !!d)
  const soonest = dues.map((d) => d.dueOn).sort()[0] ?? null
  const nextAmount = dues
    .filter((d) => d.dueOn === soonest)
    .reduce((n, d) => n + (d.amount - d.paid), 0)

  return {
    total,
    paid,
    remaining,
    overdueCount,
    nextDueOn: soonest,
    nextAmount,
    progress: total > 0 ? Math.min(1, paid / total) : 0,
    isComplete: remaining <= 0,
  }
}

export function CardPage() {
  const { cardName = '' } = useParams()
  const name = decodeURIComponent(cardName)
  const navigate = useNavigate()
  const toast = useToast()
  const plans = usePlans()
  const settings = useSettings()
  const catMap = useCategoryMap()
  const t = useActiveTheme()
  const currency = settings?.currency ?? 'EUR'
  const partner = settings?.partnerName?.trim() || 'Partner'

  const members = useMemo(
    () => (plans ?? []).filter((v) => (v.plan.cardName ?? '') === name),
    [plans, name],
  )
  const totals = cardTotals(members)
  const money = (c: number) => formatMoney(c, currency, { compact: true })
  const [paying, setPaying] = useState(false)
  const splitCount = members.filter((v) => planSplitPct(v.plan) != null).length

  return (
    <Screen
      title={name}
      subtitle={
        members.length === 1 ? '1 purchase' : `${members.length} purchases`
      }
      back="/plans"
    >
      {members.length === 0 ? (
        <Card>
          <EmptyState
            emoji={t.emptyIcon.recurring}
            title="Nothing on this card"
            hint="Add a plan and give it this card's name to see it here."
          />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col items-center gap-3 py-6">
            <Ring value={totals.progress} size={200} stroke={20}>
              <div>
                <p className="text-xs font-bold text-ink-soft">
                  {totals.isComplete ? 'all paid' : 'still to pay'}
                </p>
                <p className="text-[2rem] leading-tight font-extrabold text-ink tabular-nums">
                  {money(totals.isComplete ? totals.total : totals.remaining)}
                </p>
                <p className="text-xs font-semibold text-ink-faint">
                  of {money(totals.total)}
                </p>
              </div>
            </Ring>

            <div className="flex w-full justify-around text-center">
              <Stat label="paid" value={money(totals.paid)} />
              <Stat label="left" value={money(totals.remaining)} />
              <Stat
                label={totals.overdueCount > 0 ? 'overdue' : 'next bill'}
                value={totals.nextDueOn ? money(totals.nextAmount) : '—'}
                danger={totals.overdueCount > 0}
              />
            </div>

            {!totals.isComplete && (
              <Button full onClick={() => setPaying(true)}>
                Pay the card
              </Button>
            )}

            {totals.nextDueOn && (
              <p className="text-xs font-semibold text-ink-faint">
                {totals.overdueCount > 0 ? 'oldest unpaid ' : 'due '}
                {shortDate(totals.nextDueOn)}
                {splitCount > 0 && ` · ${splitCount} split with ${partner}`}
              </p>
            )}
          </Card>

          <PayCardSheet
            open={paying}
            onClose={() => setPaying(false)}
            members={members}
            currency={currency}
            suggested={totals.nextAmount}
            onSubmit={async (amount, paidOn, note) => {
              const parts = await payCard(members, { amount, paidOn, note })
              setPaying(false)
              toast(
                cheer(
                  parts.length === 1
                    ? 'Payment recorded 💕'
                    : `Paid across ${parts.length} purchases 💕`,
                ),
              )
            }}
          />

          <section>
            <SectionTitle>What's on it</SectionTitle>
            <div className="mt-1 flex flex-col gap-2">
              {members.map((v) => (
                <PlanRow
                  key={v.plan.id}
                  view={v}
                  currency={currency}
                  partner={partner}
                  category={
                    v.plan.categoryId ? (catMap?.get(v.plan.categoryId) ?? null) : null
                  }
                  onClick={() => navigate(`/plans/${v.plan.id}`)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </Screen>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p
        className="font-extrabold tabular-nums"
        style={{ color: danger ? 'var(--color-over)' : 'var(--color-ink)' }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-ink-faint">{label}</p>
    </div>
  )
}

function PayCardSheet({
  open,
  onClose,
  members,
  currency,
  suggested,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  members: PlanView[]
  currency: string
  suggested: number
  onSubmit: (amount: number, paidOn: string, note: string) => void
}) {
  const [amount, setAmount] = useState(suggested)
  const [paidOn, setPaidOn] = useState(todayStr())
  const [note, setNote] = useState('')
  const [seeded, setSeeded] = useState(false)

  if (open && !seeded) {
    setSeeded(true)
    setAmount(suggested)
    setPaidOn(todayStr())
    setNote('')
  }
  if (!open && seeded) setSeeded(false)

  const outstanding = cardOutstanding(members)
  const capped = Math.min(amount, outstanding)
  const parts: CardAllocation[] = useMemo(
    () => (capped > 0 ? allocateCardPayment(members, capped) : []),
    [members, capped],
  )
  const money = (c: number) => formatMoney(c, currency, { compact: true })

  return (
    <Sheet open={open} onClose={onClose} title="Pay the card">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (capped <= 0) return
          onSubmit(capped, paidOn, note)
        }}
      >
        <MoneyKeypad cents={amount} onChange={setAmount} currency={currency} />

        <div className="flex gap-2">
          <Button variant="soft" full onClick={() => setAmount(suggested)}>
            This month {money(suggested)}
          </Button>
          <Button variant="soft" full onClick={() => setAmount(outstanding)}>
            All of it {money(outstanding)}
          </Button>
        </div>

        {amount > outstanding && (
          <p className="px-1 text-xs font-semibold text-ink-faint">
            The card only owes {money(outstanding)}, so that is what will be paid.
          </p>
        )}

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
            placeholder="e.g. monthly bill"
            className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
          />
        </label>

        {parts.length > 0 && (
          <div className="rounded-2xl bg-blush/50 px-4 py-3">
            <p className="mb-1.5 text-xs font-bold text-ink-soft">Where it goes</p>
            {parts.map((p) => (
              <p
                key={p.planId}
                className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink-soft"
              >
                <span className="truncate">
                  {p.planName}
                  {p.yourShare != null && p.yourShare < p.amount && (
                    <span className="text-xs text-ink-faint"> · {money(p.yourShare)} yours</span>
                  )}
                </span>
                <span className="shrink-0 font-extrabold text-ink tabular-nums">
                  {money(p.amount)}
                </span>
              </p>
            ))}
          </div>
        )}

        <Button type="submit" full disabled={capped <= 0}>
          Pay {money(capped)}
        </Button>
      </form>
    </Sheet>
  )
}
