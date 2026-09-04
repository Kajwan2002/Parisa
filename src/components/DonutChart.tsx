import type { ReactNode } from 'react'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  children?: ReactNode
}

export function DonutChart({ slices, size = 180, thickness = 26, children }: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 : 0 // px gap between segments

  let offset = 0
  const segs =
    total > 0
      ? slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const frac = s.value / total
            const len = Math.max(0, frac * circ - gap)
            const seg = { ...s, dash: `${len} ${circ - len}`, offset: -offset }
            offset += frac * circ
            return seg
          })
      : []

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-blush)"
          strokeWidth={thickness}
        />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
