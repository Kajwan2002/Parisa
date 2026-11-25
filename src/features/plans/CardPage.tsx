import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useActiveTheme, useCategoryMap, usePlans, useSettings } from '@/db/queries'
import { planSplitPct } from '@/db/plans'
import type { PlanView } from '@/db/plans'
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

            {totals.nextDueOn && (
              <p className="text-xs font-semibold text-ink-faint">
                {totals.overdueCount > 0 ? 'oldest unpaid ' : 'due '}
                {shortDate(totals.nextDueOn)}
                {splitCount > 0 && ` · ${splitCount} split with ${partner}`}
              </p>
            )}
          </Card>

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
