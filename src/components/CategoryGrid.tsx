import { CategoryBadge } from '@/components/CategoryBadge'
import { cn } from '@/lib/cn'
import type { Category } from '@/db/types'

interface CategoryGridProps {
  categories: Category[]
  value: string | null
  onChange: (id: string) => void
  /** when given, renders a "＋ New" tile that calls this */
  onCreateNew?: () => void
}

export function CategoryGrid({ categories, value, onChange, onCreateNew }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-2xl p-2 transition',
            value === c.id ? 'bg-blush ring-2 ring-rose' : 'active:bg-blush/50',
          )}
        >
          <CategoryBadge category={c} size={40} />
          <span className="line-clamp-1 text-[0.65rem] font-semibold text-ink">{c.name}</span>
        </button>
      ))}
      {onCreateNew && (
        <button
          type="button"
          onClick={onCreateNew}
          className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-ink-faint p-2 text-ink-soft active:bg-blush/50"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blush text-xl">＋</span>
          <span className="text-[0.65rem] font-semibold">New</span>
        </button>
      )}
    </div>
  )
}
