import { useMemo } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EmptyState } from '@/components/EmptyState'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { withAlpha } from '@/lib/color'
import { currentMonthKey, monthLabel } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useActiveTheme, useCategoryMap, useMonthExpenses, useSettings } from '@/db/queries'
import { ExpenseList } from '@/features/expenses/ExpenseList'

/** `:catId` standing for "expenses with no category" */
export const UNCATEGORISED = 'none'

/** Where tapping a category in a breakdown goes. */
export function categoryMonthPath(categoryId: string | null, monthKey: string): string {
  return `/history/category/${categoryId ?? UNCATEGORISED}?month=${monthKey}`
}

/** Every transaction in one category, for one month. */
export function CategoryMonthPage() {
  const { catId = UNCATEGORISED } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const monthKey = params.get('month') || currentMonthKey()
  const settings = useSettings()
  const currency = settings?.currency ?? 'EUR'
  const expenses = useMonthExpenses(monthKey)
  const catMap = useCategoryMap()
  const t = useActiveTheme()

  const uncategorised = catId === UNCATEGORISED
  const category = uncategorised ? null : (catMap?.get(catId) ?? null)
  const name = uncategorised ? 'Uncategorised' : (category?.name ?? 'Category')

  const rows = useMemo(() => {
    const want = uncategorised ? null : catId
    return (expenses ?? []).filter((e) => e.categoryId === want)
  }, [expenses, catId, uncategorised])

  const total = useMemo(() => rows.reduce((n, e) => n + e.amount, 0), [rows])
  const monthTotal = useMemo(
    () => (expenses ?? []).reduce((n, e) => n + e.amount, 0),
    [expenses],
  )

  const budget = category?.monthlyBudget ?? null
  const hasBudget = budget != null && budget > 0
  const overBudget = hasBudget && total > budget
  const share = monthTotal > 0 ? total / monthTotal : 0
  const color = category?.color ?? '#e7d3db'

  // Go back to wherever this was opened from — the dashboard and history both
  // lead here. On a cold load there is nothing to go back to, so fall back to
  // the month this belongs to.
  const openedFromInsideApp = location.key !== 'default'

  return (
    <Screen
      title={name}
      subtitle={monthLabel(monthKey)}
      back={openedFromInsideApp || `/history?month=${monthKey}`}
    >
      <Card className="flex items-center gap-4">
        <Ring
          value={hasBudget ? total / budget : share}
          size={76}
          stroke={8}
          color={color}
          trackColor={withAlpha(color, 0.22)}
        >
          <CategoryBadge category={category} size={52} className="rounded-full" />
        </Ring>
        <div className="min-w-0 flex-1">
          <p
            className="text-2xl font-extrabold tabular-nums"
            style={{ color: overBudget ? 'var(--color-over)' : 'var(--color-ink)' }}
          >
            {formatMoney(total, currency, { compact: true })}
          </p>
          <p className="text-xs font-semibold text-ink-faint">
            {rows.length === 1 ? '1 expense' : `${rows.length} expenses`}
            {hasBudget
              ? ` · of ${formatMoney(budget, currency, { compact: true })} budget`
              : monthTotal > 0
                ? ` · ${Math.round(share * 100)}% of the month`
                : ''}
          </p>
        </div>
      </Card>

      {rows.length > 0 ? (
        <ExpenseList expenses={rows} currency={currency} />
      ) : (
        <Card>
          <EmptyState
            emoji={t.emptyIcon.history}
            title="Nothing here"
            hint={`No ${name} expenses in ${monthLabel(monthKey)}.`}
          />
        </Card>
      )}
    </Screen>
  )
}
