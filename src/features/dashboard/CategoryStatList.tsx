import { Ring } from '@/components/Ring'
import { withAlpha } from '@/lib/color'
import { formatMoney } from '@/lib/money'
import type { CategorySpend } from '@/db/queries'

interface CategoryStatListProps {
  items: CategorySpend[]
  currency: string
  onSelect?: (categoryId: string | null) => void
}

export function CategoryStatList({ items, currency, onSelect }: CategoryStatListProps) {
  return (
    <div className="flex flex-col">
      {items.map((it, i) => {
        const color = it.category?.color ?? '#e7d3db'
        const hasBudget = it.budget != null && it.budget > 0
        const value = hasBudget ? it.spent / (it.budget as number) : it.share
        const over = hasBudget && it.spent > (it.budget as number)
        return (
          <button
            key={it.categoryId ?? 'none'}
            type="button"
            onClick={() => onSelect?.(it.categoryId)}
            className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
            style={i > 0 ? { borderTop: '1px solid var(--color-surface-2)' } : undefined}
          >
            <Ring
              value={value}
              size={44}
              stroke={5}
              color={color}
              trackColor={withAlpha(color, 0.22)}
            >
              <span className="text-base" aria-hidden>
                {it.category?.emoji ?? '❓'}
              </span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink">
                {it.category?.name ?? 'Uncategorised'}
              </p>
              <p className="text-xs font-semibold text-ink-faint">
                {hasBudget
                  ? `${formatMoney(it.spent, currency, { compact: true })} of ${formatMoney(
                      it.budget as number,
                      currency,
                      { compact: true },
                    )}`
                  : `${Math.round(it.share * 100)}% of spending`}
              </p>
            </div>
            <span
              className="shrink-0 font-extrabold tabular-nums"
              style={{ color: over ? 'var(--color-over)' : 'var(--color-ink)' }}
            >
              {formatMoney(it.spent, currency, { compact: true })}
            </span>
          </button>
        )
      })}
    </div>
  )
}
