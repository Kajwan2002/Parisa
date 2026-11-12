import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryBadge } from '@/components/CategoryBadge'
import { cn } from '@/lib/cn'
import { dayHeading } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useCategoryMap } from '@/db/queries'
import type { CashRow } from '@/db/queries'
import type { Category } from '@/db/types'
import { useExpenseEditor } from '@/features/expenses/ExpenseEditorProvider'

/**
 * The money side of a month: what actually left (or came back into) your
 * account, rather than what you consumed. Mirrors ExpenseList's day grouping so
 * switching between the two views doesn't feel like changing screens.
 */
export function CashList({
  rows,
  currency,
  partner,
}: {
  rows: CashRow[]
  currency: string
  partner: string
}) {
  const catMap = useCategoryMap()

  const groups = useMemo(() => {
    const map = new Map<string, CashRow[]>()
    for (const r of rows) {
      const arr = map.get(r.date) ?? []
      arr.push(r)
      map.set(r.date, arr)
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }))
  }, [rows])

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const dayTotal = g.items.reduce((s, r) => s + r.amount, 0)
        return (
          <div key={g.key}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <span className="text-xs font-bold text-ink-soft">{dayHeading(g.key)}</span>
              <span className="text-xs font-bold text-ink-faint">
                {formatMoney(dayTotal, currency, { compact: true })}
              </span>
            </div>
            <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
              {g.items.map((r, i) => (
                <CashRowItem
                  key={`${r.kind}:${r.id}`}
                  row={r}
                  currency={currency}
                  partner={partner}
                  category={r.categoryId ? (catMap?.get(r.categoryId) ?? null) : null}
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

function CashRowItem({
  row,
  currency,
  partner,
  category,
  divider,
}: {
  row: CashRow
  currency: string
  partner: string
  category: Category | null
  divider: boolean
}) {
  const navigate = useNavigate()
  const { openEdit, openEditTab } = useExpenseEditor()
  const money = (c: number) => formatMoney(Math.abs(c), currency, { compact: true })
  const incoming = row.amount < 0

  const open = () => {
    if (row.kind === 'settlement') navigate('/tab')
    else if (row.kind === 'shared' && row.tabEntryId) openEditTab(row.tabEntryId)
    else openEdit(row.id)
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-blush/40"
      style={divider ? { borderTop: '1px solid var(--color-surface-2)' } : undefined}
    >
      {row.kind === 'settlement' ? (
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-mint/30 text-lg">
          🤝
        </span>
      ) : (
        <CategoryBadge category={category} size={42} />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-bold text-ink">
          {row.kind === 'shared' && (
            <span className="text-xs text-ink-faint" aria-label="Split">
              🤝
            </span>
          )}
          <span className="truncate">{row.label}</span>
        </p>
        <p className="truncate text-xs font-semibold text-ink-faint">
          {row.kind === 'shared'
            ? `you paid · your share ${money(row.yourShare ?? 0)}`
            : row.kind === 'settlement'
              ? incoming
                ? `${partner} paid you back`
                : `you paid ${partner} back`
              : (category?.name ?? 'Uncategorised')}
        </p>
      </div>

      <span
        className={cn(
          'shrink-0 font-extrabold tabular-nums',
          incoming ? 'text-good' : 'text-ink',
        )}
      >
        {incoming ? '+' : ''}
        {money(row.amount)}
      </span>
    </button>
  )
}
