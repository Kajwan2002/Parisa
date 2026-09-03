import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { MoneyField } from '@/components/MoneyField'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { withAlpha } from '@/lib/color'
import { currentMonthKey, monthLabel } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { updateCategory, updateSettings } from '@/db/repo'
import { useCategories, useMonthSummary, useSettings } from '@/db/queries'
import type { Category } from '@/db/types'

export function BudgetsPage() {
  const toast = useToast()
  const settings = useSettings()
  const categories = useCategories()
  const monthKey = currentMonthKey()
  const summary = useMonthSummary(monthKey)
  const currency = settings?.currency ?? 'EUR'

  const [overall, setOverall] = useState(0)
  useEffect(() => {
    if (settings) setOverall(settings.overallMonthlyBudget ?? 0)
  }, [settings])

  const [editingCat, setEditingCat] = useState<Category | null>(null)

  const spent = summary?.spent ?? 0
  const spentByCat = new Map(
    (summary?.byCategory ?? []).map((c) => [c.categoryId, c.spent] as const),
  )

  const overallDirty = (settings?.overallMonthlyBudget ?? 0) !== overall

  return (
    <Screen title="Budgets" subtitle={monthLabel(monthKey)} back="/settings">
      {/* overall */}
      <Card className="flex flex-col items-center gap-4 py-6">
        <Ring value={overall > 0 ? spent / overall : 0} size={168} stroke={16}>
          <div>
            <p className="text-xs font-bold text-ink-soft">spent</p>
            <p className="text-2xl font-extrabold text-ink tabular-nums">
              {formatMoney(spent, currency, { compact: true })}
            </p>
            {overall > 0 && (
              <p className="text-xs font-semibold text-ink-faint">
                of {formatMoney(overall, currency, { compact: true })}
              </p>
            )}
          </div>
        </Ring>

        <div className="w-full">
          <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">
            Overall monthly budget <span className="font-medium text-ink-faint">(optional)</span>
          </p>
          <MoneyField cents={overall} onChange={setOverall} currency={currency} placeholder="No budget" />
        </div>
        {overallDirty && (
          <Button
            full
            onClick={async () => {
              await updateSettings({ overallMonthlyBudget: overall > 0 ? overall : null })
              toast('Budget saved 💕')
            }}
          >
            Save budget
          </Button>
        )}
      </Card>

      {/* per category */}
      <section>
        <SectionTitle>Per category</SectionTitle>
        <div className="mt-1 flex flex-col gap-2">
          {(categories ?? []).map((c) => {
            const s = spentByCat.get(c.id) ?? 0
            const has = c.monthlyBudget != null && c.monthlyBudget > 0
            const over = has && s > (c.monthlyBudget as number)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditingCat(c)}
                className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80"
              >
                <Ring
                  value={has ? s / (c.monthlyBudget as number) : 0}
                  size={44}
                  stroke={5}
                  color={c.color}
                  trackColor={withAlpha(c.color, 0.22)}
                >
                  <span className="text-base">{c.emoji}</span>
                </Ring>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{c.name}</p>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: over ? 'var(--color-over)' : 'var(--color-ink-faint)' }}
                  >
                    {has
                      ? `${formatMoney(s, currency, { compact: true })} of ${formatMoney(
                          c.monthlyBudget as number,
                          currency,
                          { compact: true },
                        )}`
                      : 'Tap to set a budget'}
                  </p>
                </div>
                <span className="text-ink-faint">›</span>
              </button>
            )
          })}
        </div>
      </section>

      <Sheet
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        title={editingCat ? `${editingCat.emoji} ${editingCat.name}` : ''}
      >
        {editingCat && (
          <CategoryBudgetBody
            category={editingCat}
            currency={currency}
            onDone={() => setEditingCat(null)}
          />
        )}
      </Sheet>
    </Screen>
  )
}

function CategoryBudgetBody({
  category,
  currency,
  onDone,
}: {
  category: Category
  currency: string
  onDone: () => void
}) {
  const toast = useToast()
  const [value, setValue] = useState(category.monthlyBudget ?? 0)

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">Monthly budget</p>
        <MoneyField cents={value} onChange={setValue} currency={currency} placeholder="No budget" />
      </div>
      <div className="flex gap-2">
        {category.monthlyBudget != null && (
          <Button
            variant="ghost"
            full
            onClick={async () => {
              await updateCategory(category.id, { monthlyBudget: null })
              toast('Budget removed')
              onDone()
            }}
          >
            Remove
          </Button>
        )}
        <Button
          full
          onClick={async () => {
            await updateCategory(category.id, { monthlyBudget: value > 0 ? value : null })
            toast('Saved 💕')
            onDone()
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
