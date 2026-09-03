import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { currencySymbol, formatMoney } from '@/lib/money'

interface MoneyKeypadProps {
  cents: number
  onChange: (cents: number) => void
  currency?: string
}

const MAX = 99_999_999 // €999,999.99

export function MoneyKeypad({ cents, onChange, currency = 'EUR' }: MoneyKeypadProps) {
  const press = (d: number) => {
    const next = cents * 10 + d
    onChange(Math.min(MAX, next))
  }
  const back = () => onChange(Math.floor(cents / 10))

  return (
    <div>
      <div className="flex items-end justify-center gap-1 py-4">
        <span className="pb-1 text-2xl font-bold text-ink-soft">{currencySymbol(currency)}</span>
        <span className="text-5xl font-extrabold tracking-tight text-ink tabular-nums">
          {formatMoney(cents, currency).replace(currencySymbol(currency), '').trim()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <Key key={n} onClick={() => press(n)}>
            {n}
          </Key>
        ))}
        <Key onClick={() => press(0)} className="col-start-2">
          0
        </Key>
        <Key onClick={back} aria-label="Delete">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M13 9l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Key>
      </div>
    </div>
  )
}

function Key({
  children,
  onClick,
  className,
  ...rest
}: {
  children: ReactNode
  onClick: () => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid h-14 place-items-center rounded-2xl bg-surface text-2xl font-bold text-ink shadow-card',
        'active:scale-95 active:bg-blush',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
