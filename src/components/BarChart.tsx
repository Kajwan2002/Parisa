import { cn } from '@/lib/cn'

export interface Bar {
  label: string
  value: number
  highlight?: boolean
}

interface BarChartProps {
  bars: Bar[]
  formatValue?: (v: number) => string
  height?: number
  onBarClick?: (index: number) => void
}

export function BarChart({ bars, formatValue, height = 150, onBarClick }: BarChartProps) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  const peak = bars.findIndex((b) => b.value === max && b.value > 0)

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max(4, (b.value / max) * (height - 26)) : 3
        return (
          <button
            key={i}
            type="button"
            disabled={!onBarClick}
            onClick={() => onBarClick?.(i)}
            className="group flex flex-1 flex-col items-center justify-end gap-1"
          >
            {i === peak && formatValue && (
              <span className="text-[0.6rem] font-bold text-ink-soft">
                {formatValue(b.value)}
              </span>
            )}
            <div
              className={cn(
                'w-full rounded-full transition-all',
                b.highlight ? 'bg-rose' : b.value > 0 ? 'bg-rose-soft' : 'bg-blush',
                onBarClick && 'group-active:opacity-70',
              )}
              style={{ height: h }}
            />
            <span
              className={cn(
                'text-[0.6rem] font-semibold',
                b.highlight ? 'text-rose-deep' : 'text-ink-faint',
              )}
            >
              {b.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
