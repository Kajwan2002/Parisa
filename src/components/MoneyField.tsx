import { useEffect, useRef, useState } from 'react'
import { currencySymbol, fromCents, toCents } from '@/lib/money'

interface MoneyFieldProps {
  cents: number
  onChange: (cents: number) => void
  currency?: string
  placeholder?: string
}

/** A plain text field for entering an amount (used for budgets). */
export function MoneyField({ cents, onChange, currency = 'EUR', placeholder }: MoneyFieldProps) {
  const [text, setText] = useState(cents > 0 ? String(fromCents(cents)) : '')
  const lastEmitted = useRef(cents)

  // If the parent changes the value for a reason other than our own onChange
  // (e.g. a form reset), reflect it in the field.
  useEffect(() => {
    if (cents !== lastEmitted.current) {
      setText(cents > 0 ? String(fromCents(cents)) : '')
      lastEmitted.current = cents
    }
  }, [cents])

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-rose-soft">
      <span className="font-bold text-ink-soft">{currencySymbol(currency)}</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? '0.00'}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.,]/g, '')
          setText(v)
          const c = toCents(v || '0')
          lastEmitted.current = c
          onChange(c)
        }}
        className="w-full bg-transparent font-semibold text-ink outline-none placeholder:text-ink-faint"
      />
    </div>
  )
}
