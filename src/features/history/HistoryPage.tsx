import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '@/components/BarChart'
import { Card, SectionTitle } from '@/components/Card'
import { DonutChart } from '@/components/DonutChart'
import { EmptyState } from '@/components/EmptyState'
import { PeriodNav } from '@/components/PeriodNav'
import { Screen } from '@/components/Screen'
import { Segmented } from '@/components/Segmented'
import {
  currentMonthKey,
  currentYearKey,
  monthLabel,
  monthLabelNoYear,
  shiftMonth,
  shiftYear,
} from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  useActiveTheme,
  useCategoryMap,
  useMonthExpenses,
  useMonthSummary,
  useSettings,
  useYearSummary,
} from '@/db/queries'
import { CategoryStatList } from '@/features/dashboard/CategoryStatList'
import { ExpenseList } from '@/features/expenses/ExpenseList'

type Mode = 'month' | 'year'

/** `?cat=` value standing for "expenses with no category" */
const UNCATEGORISED = 'none'

export function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const currency = settings?.currency ?? 'EUR'

  const [mode, setMode] = useState<Mode>('month')
  const [monthKey, setMonthKey] = useState(params.get('month') || currentMonthKey())
  const [yearKey, setYearKey] = useState(currentYearKey())
  const catFilter = params.get('cat')

  const clearFilter = () => {
    const next = new URLSearchParams(params)
    next.delete('cat')
    setParams(next, { replace: true })
  }

  // Tapping a category in the breakdown filters the list below to that
  // category for the month on screen; tapping it again clears the filter.
  // `null` is a real choice (uncategorised), so it needs its own token rather
  // than meaning "no filter".
  const selectCategory = (id: string | null) => {
    const token = id ?? UNCATEGORISED
    const next = new URLSearchParams(params)
    if (catFilter === token) next.delete('cat')
    else next.set('cat', token)
    next.set('month', monthKey)
    setParams(next, { replace: true })
  }

  return (
    <Screen title="History">
      <Segmented
        options={[
          { value: 'month', label: 'Monthly' },
          { value: 'year', label: 'Yearly' },
        ]}
        value={mode}
        onChange={(m) => setMode(m as Mode)}
      />

      {mode === 'month' ? (
        <MonthView
          monthKey={monthKey}
          currency={currency}
          catFilter={catFilter}
          onClearFilter={clearFilter}
          onSelectCategory={selectCategory}
          onPrev={() => setMonthKey((k) => shiftMonth(k, -1))}
          onNext={() => setMonthKey((k) => shiftMonth(k, 1))}
        />
      ) : (
        <YearView
          yearKey={yearKey}
          currency={currency}
          onPrev={() => setYearKey((k) => shiftYear(k, -1))}
          onNext={() => setYearKey((k) => shiftYear(k, 1))}
          onPickMonth={(mk) => {
            setMonthKey(mk)
            setMode('month')
          }}
        />
      )}
    </Screen>
  )
}

function MonthView({
  monthKey,
  currency,
  catFilter,
  onClearFilter,
  onSelectCategory,
  onPrev,
  onNext,
}: {
  monthKey: string
  currency: string
  catFilter: string | null
  onClearFilter: () => void
  onSelectCategory: (categoryId: string | null) => void
  onPrev: () => void
  onNext: () => void
}) {
  const summary = useMonthSummary(monthKey)
  const expenses = useMonthExpenses(monthKey)
  const catMap = useCategoryMap()
  const t = useActiveTheme()

  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const all = expenses ?? []
    if (!catFilter) return all
    const want = catFilter === UNCATEGORISED ? null : catFilter
    return all.filter((e) => e.categoryId === want)
  }, [expenses, catFilter])

  const filteredTotal = useMemo(() => filtered.reduce((n, e) => n + e.amount, 0), [filtered])

  const filterName = !catFilter
    ? null
    : catFilter === UNCATEGORISED
      ? 'Uncategorised'
      : (catMap?.get(catFilter)?.name ?? 'Category')

  const pickCategory = (id: string | null) => {
    onSelectCategory(id)
    // bring the transactions into view — the breakdown sits above them
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const slices = useMemo(
    () =>
      (summary?.byCategory ?? [])
        .filter((c) => c.spent > 0)
        .slice(0, 8)
        .map((c) => ({
          label: c.category?.name ?? 'Other',
          value: c.spent,
          color: c.category?.color ?? '#e7d3db',
        })),
    [summary],
  )

  return (
    <>
      <PeriodNav
        label={monthLabel(monthKey)}
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled={monthKey >= currentMonthKey()}
      />

      <Card className="flex flex-col items-center gap-4 py-6">
        <DonutChart slices={slices} size={172} thickness={24}>
          <div>
            <p className="text-xs font-bold text-ink-soft">spent</p>
            <p className="text-2xl font-extrabold text-ink tabular-nums">
              {formatMoney(summary?.spent ?? 0, currency, { compact: true })}
            </p>
          </div>
        </DonutChart>
        <div className="flex w-full justify-around text-center">
          <Stat label="income" value={formatMoney(summary?.income ?? 0, currency, { compact: true })} />
          <Stat
            label="per day"
            value={formatMoney(Math.round(summary?.perDay ?? 0), currency, { compact: true })}
          />
          <Stat label="expenses" value={String(summary?.expenseCount ?? 0)} />
        </div>
      </Card>

      {(summary?.byCategory.length ?? 0) > 0 && (
        <section>
          <SectionTitle>By category</SectionTitle>
          <Card className="py-2">
            <CategoryStatList
              items={summary!.byCategory}
              currency={currency}
              onSelect={pickCategory}
            />
          </Card>
        </section>
      )}

      <section ref={listRef} className="scroll-mt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <SectionTitle className="truncate">{filterName ?? 'All expenses'}</SectionTitle>
            {catFilter && (
              <p className="px-1 text-xs font-semibold text-ink-faint">
                {formatMoney(filteredTotal, currency, { compact: true })} ·{' '}
                {filtered.length === 1 ? '1 expense' : `${filtered.length} expenses`} in{' '}
                {monthLabelNoYear(monthKey)}
              </p>
            )}
          </div>
          {catFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="shrink-0 rounded-full bg-blush px-3 py-1 text-xs font-bold text-rose-deep"
            >
              Clear ✕
            </button>
          )}
        </div>
        {filtered.length > 0 ? (
          <ExpenseList expenses={filtered} currency={currency} />
        ) : (
          <Card>
            <EmptyState
              emoji={t.emptyIcon.history}
              title="Nothing here"
              hint={
                filterName
                  ? `No ${filterName} expenses in ${monthLabelNoYear(monthKey)}.`
                  : 'No expenses for this period.'
              }
            />
          </Card>
        )}
      </section>
    </>
  )
}

function YearView({
  yearKey,
  currency,
  onPrev,
  onNext,
  onPickMonth,
}: {
  yearKey: string
  currency: string
  onPrev: () => void
  onNext: () => void
  onPickMonth: (monthKey: string) => void
}) {
  const summary = useYearSummary(yearKey)
  const t = useActiveTheme()

  const bars = useMemo(
    () =>
      (summary?.monthly ?? []).map((m) => ({
        label: monthLabelNoYear(m.monthKey).slice(0, 1),
        value: m.spent,
        highlight: m.monthKey === currentMonthKey(),
      })),
    [summary],
  )

  return (
    <>
      <PeriodNav
        label={yearKey}
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled={yearKey >= currentYearKey()}
      />

      <Card className="flex flex-col gap-5 py-6">
        <div className="flex justify-around text-center">
          <Stat label="spent" value={formatMoney(summary?.total ?? 0, currency, { compact: true })} />
          <Stat label="income" value={formatMoney(summary?.income ?? 0, currency, { compact: true })} />
          <Stat
            label="monthly avg"
            value={formatMoney(Math.round(summary?.average ?? 0), currency, { compact: true })}
          />
        </div>
        <BarChart
          bars={bars}
          formatValue={(v) => formatMoney(v, currency, { compact: true })}
          onBarClick={(i) => summary && onPickMonth(summary.monthly[i].monthKey)}
        />
      </Card>

      {(summary?.byCategory.length ?? 0) > 0 ? (
        <section>
          <SectionTitle>Top categories this year</SectionTitle>
          <Card className="py-2">
            <CategoryStatList
              items={(summary?.byCategory ?? []).slice(0, 10).map((c) => ({
                category: c.category,
                categoryId: c.category?.id ?? null,
                spent: c.spent,
                budget: null,
                share: c.share,
              }))}
              currency={currency}
            />
          </Card>
        </section>
      ) : (
        <Card>
          <EmptyState emoji={t.emptyIcon.year} title={`Nothing logged in ${yearKey}`} hint="Add expenses and they'll show up here." />
        </Card>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-extrabold text-ink tabular-nums">{value}</p>
      <p className="text-xs font-bold text-ink-soft">{label}</p>
    </div>
  )
}
