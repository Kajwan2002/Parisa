import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { currencySymbol, fromCents, toCents } from '@/lib/money'

interface SplitSliderProps {
  total: number // cents
  yourShare: number // cents
  onChange: (yourShare: number) => void
  currency?: string
  partnerName?: string
}

export function SplitSlider({
  total,
  yourShare,
  onChange,
  currency = 'EUR',
  partnerName,
}: SplitSliderProps) {
  const partner = partnerName?.trim() || 'Partner'
  const clamped = Math.max(0, Math.min(total, yourShare))
  const partnerShare = Math.max(0, total - clamped)
  const pct = total > 0 ? Math.round((clamped / total) * 100) : 50
  const disabled = total <= 0

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card">
      <div className="grid grid-cols-2 gap-2">
        <ShareInput
          label="You"
          cents={clamped}
          currency={currency}
          disabled={disabled}
          onCommit={(c) => onChange(Math.min(total, Math.max(0, c)))}
        />
        <ShareInput
          label={partner}
          cents={partnerShare}
          currency={currency}
          disabled={disabled}
          onCommit={(c) => onChange(Math.min(total, Math.max(0, total - c)))}
        />
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(1, total)}
        step={1}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-rose)] disabled:opacity-40"
        style={{
          background: `linear-gradient(to right, var(--color-rose) ${pct}%, var(--color-blush) ${pct}%)`,
        }}
        aria-label="Your share of the split"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-faint">{pct}% yours</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.round(total / 2))}
          className="rounded-full bg-blush px-3 py-1 text-xs font-bold text-rose-deep disabled:opacity-40"
        >
          Split 50/50
        </button>
      </div>
    </div>
  )
}

function ShareInput({
  label,
  cents,
  currency,
  disabled,
  onCommit,
}: {
  label: string
  cents: number
  currency: string
  disabled: boolean
  onCommit: (cents: number) => void
}) {
  const fmt = (c: number) => (c > 0 ? String(fromCents(c)) : '')
  const [text, setText] = useState(fmt(cents))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setText(fmt(cents))
  }, [cents])

  return (
    <label
      className={cn(
        'flex flex-col rounded-2xl bg-blush/40 px-3 py-2',
        disabled && 'opacity-40',
      )}
    >
      <span className="text-[0.7rem] font-bold text-ink-soft">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold text-ink-soft">{currencySymbol(currency)}</span>
        <input
          inputMode="decimal"
          disabled={disabled}
          value={text}
          onFocus={() => {
            editing.current = true
          }}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.,]/g, '')
            setText(v)
            onCommit(toCents(v || '0'))
          }}
          onBlur={() => {
            editing.current = false
            setText(fmt(cents))
          }}
          className="w-full min-w-0 bg-transparent font-extrabold text-ink outline-none"
        />
      </div>
    </label>
  )
}
