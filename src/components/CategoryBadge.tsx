import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/color'
import type { Category } from '@/db/types'

interface CategoryBadgeProps {
  category: Category | null
  size?: number
  className?: string
}

export function CategoryBadge({ category, size = 44, className }: CategoryBadgeProps) {
  const color = category?.color ?? '#e7d3db'
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-2xl', className)}
      style={{
        width: size,
        height: size,
        background: withAlpha(color, 0.28),
        fontSize: size * 0.5,
      }}
    >
      <span aria-hidden>{category?.emoji ?? '❓'}</span>
    </div>
  )
}
