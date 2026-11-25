import { CategoryBadge } from '@/components/CategoryBadge'
import { Ring } from '@/components/Ring'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/color'
import { shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { planSplitPct, type PlanView } from '@/db/plans'

/** One plan in a list — on the Plans screen, or under a card. */
export function PlanRow({
  view,
  currency,
  partner,
  category,
  onClick,
}: {
  view: PlanView
  currency: string
  partner?: string
  category: Parameters<typeof CategoryBadge>[0]['category']
  onClick: () => void
}) {
  const { plan, kind, paid, remaining, progress, nextDue, isComplete, overdueCount } = view
  const color = category?.color ?? 'var(--color-rose)'
  const money = (c: number) => formatMoney(c, currency, { compact: true })
  const pct = planSplitPct(plan)

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
        <p className="flex items-center gap-1 truncate font-bold text-ink">
          {pct != null && (
            <span className="text-xs text-ink-faint" aria-label="Split">
              🤝
            </span>
          )}
          <span className="truncate">{plan.name}</span>
        </p>
        <p
          className={cn(
            'truncate text-xs font-semibold',
            overdueCount > 0 ? 'text-over' : 'text-ink-faint',
          )}
        >
          {sub}
          {pct != null && partner ? ` · ${pct}% yours` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="block font-extrabold text-ink tabular-nums">{money(remaining)}</span>
        <span className="text-[0.6rem] font-bold text-ink-faint">left</span>
      </div>
    </button>
  )
}
