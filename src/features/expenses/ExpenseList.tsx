import { useMemo } from 'react'
import { CategoryBadge } from '@/components/CategoryBadge'
import { dayHeading } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useCategoryMap } from '@/db/queries'
import type { Category, Expense } from '@/db/types'
import { useExpenseEditor } from './ExpenseEditorProvider'

interface ExpenseListProps {
  expenses: Expense[]
  currency: string
  /** group rows under Today / Yesterday / date headings */
  grouped?: boolean
}

export function ExpenseList({ expenses, currency, grouped = true }: ExpenseListProps) {
  const catMap = useCategoryMap()

  const groups = useMemo(() => {
    const sorted = [...expenses].sort(
      (a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt - a.createdAt,
    )
    if (!grouped) return [{ key: 'all', rows: sorted }]
    const map = new Map<string, Expense[]>()
    for (const e of sorted) {
      const arr = map.get(e.spentOn) ?? []
      arr.push(e)
      map.set(e.spentOn, arr)
    }
    return [...map.entries()].map(([key, rows]) => ({ key, rows }))
  }, [expenses, grouped])

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const dayTotal = g.rows.reduce((s, e) => s + e.amount, 0)
        return (
          <div key={g.key}>
            {grouped && (
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className="text-xs font-bold text-ink-soft">{dayHeading(g.key)}</span>
                <span className="text-xs font-bold text-ink-faint">
                  {formatMoney(dayTotal, currency, { compact: true })}
                </span>
              </div>
            )}
            <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
              {g.rows.map((e, i) => (
                <Row
                  key={e.id}
                  expense={e}
                  currency={currency}
                  categoryName={
                    e.categoryId ? (catMap?.get(e.categoryId)?.name ?? 'Deleted') : 'Uncategorised'
                  }
                  category={e.categoryId ? (catMap?.get(e.categoryId) ?? null) : null}
                  divider={i > 0}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Row({
  expense,
  currency,
  category,
  categoryName,
  divider,
}: {
  expense: Expense
  currency: string
  category: Category | null
  categoryName: string
  divider: boolean
}) {
  const { openEdit } = useExpenseEditor()
  return (
    <button
      type="button"
      onClick={() => openEdit(expense.id)}
      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-blush/40"
      style={divider ? { borderTop: '1px solid var(--color-surface-2)' } : undefined}
    >
      <CategoryBadge category={category} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{expense.note || categoryName}</p>
        {expense.note && (
          <p className="truncate text-xs font-semibold text-ink-faint">{categoryName}</p>
        )}
      </div>
      <span className="shrink-0 font-extrabold text-ink tabular-nums">
        {formatMoney(expense.amount, currency, { compact: true })}
      </span>
    </button>
  )
}
