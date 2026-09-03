import { useState } from 'react'
import { Card } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EmptyState } from '@/components/EmptyState'
import { PeriodNav } from '@/components/PeriodNav'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { currentMonthKey, monthLabel, shiftMonth, shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useInsights, useSettings } from '@/db/queries'

export function InsightsPage() {
  const settings = useSettings()
  const currency = settings?.currency ?? 'EUR'
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const ins = useInsights(monthKey)

  return (
    <Screen title="Insights">
      <PeriodNav
        label={monthLabel(monthKey)}
        onPrev={() => setMonthKey((k) => shiftMonth(k, -1))}
        onNext={() => setMonthKey((k) => shiftMonth(k, 1))}
        nextDisabled={monthKey >= currentMonthKey()}
      />

      {!ins || ins.spent === 0 ? (
        <Card>
          <EmptyState
            emoji="🔍"
            title="Nothing to analyse yet"
            hint="Add a few expenses this month and little insights will show up here."
          />
        </Card>
      ) : (
        <>
          {/* vs last month */}
          <Card className="flex items-center gap-4">
            <Ring
              value={ins.deltaPct == null ? 0 : Math.min(1, Math.abs(ins.deltaPct) / 100)}
              size={64}
              stroke={7}
              color={
                ins.deltaPct != null && ins.deltaPct > 0 ? 'var(--color-over)' : 'var(--color-good)'
              }
            >
              <span className="text-sm font-extrabold text-ink">
                {ins.deltaPct == null ? '—' : `${ins.deltaPct > 0 ? '+' : ''}${Math.round(ins.deltaPct)}%`}
              </span>
            </Ring>
            <div>
              <p className="font-bold text-ink">
                {ins.deltaPct == null
                  ? ins.prevSpent === 0
                    ? 'Nothing spent last month'
                    : 'First month of tracking'
                  : ins.deltaPct > 0
                    ? 'More than last month'
                    : ins.deltaPct < 0
                      ? 'Less than last month'
                      : 'Same as last month'}
              </p>
              <p className="text-sm font-semibold text-ink-soft">
                {formatMoney(ins.spent, currency, { compact: true })} vs{' '}
                {formatMoney(ins.prevSpent, currency, { compact: true })}
              </p>
            </div>
          </Card>

          {/* income used */}
          {ins.incomeUsedPct != null && (
            <Card className="flex items-center gap-4">
              <Ring
                value={ins.incomeUsedPct / 100}
                size={64}
                stroke={7}
                color="var(--color-rose)"
              >
                <span className="text-sm font-extrabold text-ink">
                  {Math.round(ins.incomeUsedPct)}%
                </span>
              </Ring>
              <div>
                <p className="font-bold text-ink">of your income spent</p>
                <p className="text-sm font-semibold text-ink-soft">
                  {ins.savedSoFar != null && ins.savedSoFar >= 0
                    ? `${formatMoney(ins.savedSoFar, currency, { compact: true })} kept so far 🌷`
                    : `${formatMoney(Math.abs(ins.savedSoFar ?? 0), currency, {
                        compact: true,
                      })} over your income`}
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <MiniCard
              label="Average per day"
              value={formatMoney(Math.round(ins.perDay), currency, { compact: true })}
            />
            <MiniCard
              label="Biggest expense"
              value={ins.biggest ? formatMoney(ins.biggest.amount, currency, { compact: true }) : '—'}
              sub={ins.biggest ? ins.biggest.note || shortDate(ins.biggest.spentOn) : undefined}
            />
          </div>

          {ins.topCategories.length > 0 && (
            <Card>
              <p className="mb-3 text-sm font-bold text-ink-soft">Top categories</p>
              <div className="flex flex-col gap-3">
                {ins.topCategories.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-extrabold text-ink-faint">{i + 1}</span>
                    <CategoryBadge category={t.category} size={38} />
                    <span className="flex-1 truncate font-bold text-ink">
                      {t.category?.name ?? 'Uncategorised'}
                    </span>
                    <span className="font-extrabold text-ink tabular-nums">
                      {formatMoney(t.spent, currency, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </Screen>
  )
}

function MiniCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <p className="text-xl font-extrabold text-ink tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs font-semibold text-ink-faint">{sub}</p>}
    </Card>
  )
}
