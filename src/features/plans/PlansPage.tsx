import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EmptyState } from '@/components/EmptyState'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/color'
import { shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useActiveTheme, useCategoryMap, usePlans, useSettings } from '@/db/queries'
import { addPlan, type PlanView } from '@/db/plans'
import { cheer } from '@/theme/apply'
import { PlanForm } from './PlanForm'

export function PlansPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const plans = usePlans()
  const settings = useSettings()
  const catMap = useCategoryMap()
  const t = useActiveTheme()
  const currency = settings?.currency ?? 'EUR'

  const [adding, setAdding] = useState(false)

  const open = (plans ?? []).filter((p) => !p.isComplete)
  const done = (plans ?? []).filter((p) => p.isComplete)

  const totalLeft = open.reduce((n, p) => n + p.remaining, 0)
  const totalOwed = open.reduce((n, p) => n + p.plan.total, 0)
  const totalPaid = totalOwed - totalLeft
  const overdue = open.reduce((n, p) => n + p.overdueCount, 0)

  return (
    <Screen
      title="Installments"
      subtitle={open.length > 0 ? `${open.length} being paid off` : undefined}
      right={
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="New plan"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose text-white shadow-soft active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      {open.length > 0 && (
        <Card className="flex flex-col items-center gap-3 py-6">
          <Ring value={totalOwed > 0 ? totalPaid / totalOwed : 0} size={200} stroke={20}>
            <div>
              <p className="text-xs font-bold text-ink-soft">left to pay</p>
              <p className="text-[2rem] leading-tight font-extrabold text-ink tabular-nums">
                {formatMoney(totalLeft, currency, { compact: true })}
              </p>
              <p className="text-xs font-semibold text-ink-faint">
                of {formatMoney(totalOwed, currency, { compact: true })}
              </p>
            </div>
          </Ring>
          <p className="text-sm font-bold text-ink-soft">
            {formatMoney(totalPaid, currency, { compact: true })} paid so far
          </p>
          {overdue > 0 && (
            <p className="rounded-full bg-over px-4 py-1.5 text-sm font-bold text-white">
              {overdue === 1 ? '1 payment overdue' : `${overdue} payments overdue`}
            </p>
          )}
        </Card>
      )}

      {(plans?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            emoji={t.emptyIcon.recurring}
            title="Nothing being paid off"
            hint="Add a bill or purchase you're paying in installments and keep track of what's left."
          />
          <Button full className="mt-3" onClick={() => setAdding(true)}>
            Add a plan
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map((v) => (
            <PlanRow
              key={v.plan.id}
              view={v}
              currency={currency}
              category={v.plan.categoryId ? (catMap?.get(v.plan.categoryId) ?? null) : null}
              onClick={() => navigate(`/plans/${v.plan.id}`)}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section>
          <SectionTitle>Paid off</SectionTitle>
          <div className="mt-1 flex flex-col gap-2">
            {done.map((v) => (
              <PlanRow
                key={v.plan.id}
                view={v}
                currency={currency}
                category={v.plan.categoryId ? (catMap?.get(v.plan.categoryId) ?? null) : null}
                onClick={() => navigate(`/plans/${v.plan.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New installment plan">
        <PlanForm
          currency={currency}
          onSubmit={async (input) => {
            const id = await addPlan(input)
            setAdding(false)
            toast(cheer('Plan added 💕'))
            navigate(`/plans/${id}`)
          }}
        />
      </Sheet>
    </Screen>
  )
}

function PlanRow({
  view,
  currency,
  category,
  onClick,
}: {
  view: PlanView
  currency: string
  category: Parameters<typeof CategoryBadge>[0]['category']
  onClick: () => void
}) {
  const { plan, kind, paid, remaining, progress, nextDue, isComplete, overdueCount } = view
  const color = category?.color ?? 'var(--color-rose)'
  const money = (c: number) => formatMoney(c, currency, { compact: true })

  const sub = isComplete
    ? 'Paid off 🎉'
    : kind === 'open'
      ? `${money(paid)} paid · pay anytime`
      : nextDue
        ? nextDue.overdue
          ? `${money(nextDue.amount - nextDue.paid)} overdue since ${shortDate(nextDue.dueOn)}`
          : `${money(nextDue.amount - nextDue.paid)} due ${shortDate(nextDue.dueOn)}`
        : 'No schedule'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80',
        isComplete && 'opacity-60',
      )}
    >
      <Ring
        value={progress}
        size={46}
        stroke={5}
        color={color}
        trackColor={withAlpha(typeof color === 'string' ? color : '#e7d3db', 0.22)}
      >
        <span className="text-sm" aria-hidden>
          {category?.emoji ?? '📄'}
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{plan.name}</p>
        <p
          className={cn(
            'truncate text-xs font-semibold',
            overdueCount > 0 ? 'text-over' : 'text-ink-faint',
          )}
        >
          {sub}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="block font-extrabold text-ink tabular-nums">{money(remaining)}</span>
        <span className="text-[0.6rem] font-bold text-ink-faint">left</span>
      </div>
    </button>
  )
}
