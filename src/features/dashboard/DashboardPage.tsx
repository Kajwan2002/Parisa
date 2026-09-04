import { useNavigate } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/Card'
import { DonutChart } from '@/components/DonutChart'
import { EmptyState } from '@/components/EmptyState'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { cn } from '@/lib/cn'
import { currentMonthKey, monthLabel } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useActiveTheme,
  useDashboard,
  useMonthExpenses,
  useSettings,
  useTabActive,
  useTabSummary,
} from '@/db/queries'
import { cheer } from '@/theme/apply'
import { useExpenseEditor } from '@/features/expenses/ExpenseEditorProvider'
import { ExpenseList } from '@/features/expenses/ExpenseList'
import { CategoryStatList } from './CategoryStatList'

export function DashboardPage() {
  const navigate = useNavigate()
  const { openNew } = useExpenseEditor()
  const monthKey = currentMonthKey()
  const settings = useSettings()
  const summary = useDashboard(monthKey)
  const monthExpenses = useMonthExpenses(monthKey)
  const tab = useTabSummary()
  const tabActive = useTabActive()
  const t = useActiveTheme()
  const currency = settings?.currency ?? 'EUR'

  const greeting = t.greeting(new Date().getHours())

  if (!summary) {
    return (
      <Screen title="Parisa" subtitle={monthLabel(monthKey)}>
        <div className="h-64 animate-pulse rounded-3xl bg-surface/60" />
      </Screen>
    )
  }

  const { spent, income, overallBudget, leftToSpend } = summary
  const target = overallBudget ?? (income > 0 ? income : null)
  const over = leftToSpend != null && leftToSpend < 0
  const slices = summary.byCategory
    .filter((c) => c.spent > 0)
    .map((c) => ({
      label: c.category?.name ?? 'Other',
      value: c.spent,
      color: c.category?.color ?? '#e7d3db',
    }))

  const center = (
    <div>
      <p className="text-xs font-bold text-ink-soft">spent this month</p>
      <p className="text-[2.1rem] font-extrabold leading-tight text-ink tabular-nums">
        {formatMoney(spent, currency, { compact: true })}
      </p>
      {target != null && (
        <p className="text-xs font-semibold text-ink-faint">
          of {formatMoney(target, currency, { compact: true })}
        </p>
      )}
    </div>
  )

  return (
    <Screen title={greeting} subtitle={monthLabel(monthKey)}>
      {/* hero */}
      <Card className="flex flex-col items-center gap-3 py-7">
        {target != null ? (
          <Ring value={spent / target} size={216} stroke={20}>
            {center}
          </Ring>
        ) : slices.length > 0 ? (
          <DonutChart slices={slices} size={216} thickness={20}>
            {center}
          </DonutChart>
        ) : (
          <Ring value={0} size={216} stroke={20}>
            {center}
          </Ring>
        )}

        {leftToSpend != null ? (
          <div
            className="rounded-full px-4 py-1.5 text-sm font-bold"
            style={{
              background: over ? 'var(--color-over)' : 'var(--color-blush)',
              color: over ? '#fff' : 'var(--color-rose-deep)',
            }}
          >
            {over
              ? `${formatMoney(Math.abs(leftToSpend), currency, { compact: true })} over`
              : `${formatMoney(leftToSpend, currency, { compact: true })} left${
                  overallBudget == null ? ' of income' : ''
                }`}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="rounded-full bg-blush px-4 py-1.5 text-sm font-bold text-rose-deep"
          >
            Set a monthly budget →
          </button>
        )}
      </Card>

      {/* shared tab */}
      {tabActive && tab && (
        <button
          type="button"
          onClick={() => navigate('/tab')}
          className="flex items-center gap-3 rounded-3xl bg-surface px-5 py-4 text-left shadow-card active:opacity-80"
        >
          <span
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg',
              tab.net > 0 ? 'bg-good/25' : tab.net < 0 ? 'bg-over/20' : 'bg-blush',
            )}
          >
            🤝
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink-soft">shared tab</p>
            <p className="truncate font-extrabold text-ink">
              {tab.net > 0
                ? `${tab.partnerName || 'Partner'} owes you ${formatMoney(tab.net, currency, { compact: true })}`
                : tab.net < 0
                  ? `You owe ${tab.partnerName || 'Partner'} ${formatMoney(-tab.net, currency, { compact: true })}`
                  : cheer('All settled ✨')}
            </p>
          </div>
          <span className="text-ink-faint">›</span>
        </button>
      )}

      {/* income strip */}
      <button
        type="button"
        onClick={() => navigate('/income')}
        className="flex items-center justify-between rounded-3xl bg-surface px-5 py-4 text-left shadow-card active:opacity-80"
      >
        <div>
          <p className="text-xs font-bold text-ink-soft">income this month</p>
          <p className="text-lg font-extrabold text-ink tabular-nums">
            {formatMoney(income, currency, { compact: true })}
          </p>
        </div>
        <span className="rounded-full bg-mint/30 px-3 py-1.5 text-xs font-bold text-ink">
          {income > 0 ? 'Manage' : 'Add income'} →
        </span>
      </button>

      {/* categories */}
      {(summary.byCategory.length > 0 || summary.settlementNet !== 0) && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <SectionTitle>Where it’s going</SectionTitle>
            <button
              type="button"
              onClick={() => navigate('/budgets')}
              className="px-1 text-xs font-bold text-rose-deep"
            >
              Budgets
            </button>
          </div>
          <Card className="py-2">
            <CategoryStatList
              items={summary.byCategory.slice(0, 6)}
              currency={currency}
              onSelect={(id) =>
                navigate(`/history?month=${monthKey}${id ? `&cat=${id}` : ''}`)
              }
            />
            {summary.settlementNet !== 0 && (
              <button
                type="button"
                onClick={() => navigate('/tab')}
                className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-70"
                style={
                  summary.byCategory.length > 0
                    ? { borderTop: '1px solid var(--color-surface-2)' }
                    : undefined
                }
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint/30 text-base">
                  🤝
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">Tab settlements</p>
                  <p className="text-xs font-semibold text-ink-faint">
                    {summary.settlementNet > 0 ? 'paid back' : 'received back'}
                  </p>
                </div>
                <span className="shrink-0 font-extrabold text-ink tabular-nums">
                  {summary.settlementNet > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(summary.settlementNet), currency, { compact: true })}
                </span>
              </button>
            )}
          </Card>
        </section>
      )}

      {/* recent */}
      <section>
        <div className="mb-1 flex items-center justify-between">
          <SectionTitle>Recent</SectionTitle>
          {(monthExpenses?.length ?? 0) > 5 && (
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="px-1 text-xs font-bold text-rose-deep"
            >
              See all
            </button>
          )}
        </div>
        {monthExpenses && monthExpenses.length > 0 ? (
          <ExpenseList
            expenses={monthExpenses.slice(0, 6)}
            currency={currency}
            grouped={false}
          />
        ) : (
          <Card>
            <EmptyState
              emoji={t.emptyIcon.expenses}
              title="No expenses yet this month"
              hint="Tap the ＋ button to add your first one."
            />
          </Card>
        )}
      </section>

      <button
        type="button"
        onClick={openNew}
        className="mt-1 rounded-full bg-rose py-3.5 text-center font-extrabold text-white shadow-soft active:scale-[0.99]"
      >
        ＋ Add expense
      </button>
    </Screen>
  )
}
