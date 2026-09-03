// Money is stored everywhere as an integer number of cents to avoid
// floating-point drift. Helpers here convert to/from that form.

export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

const fmtCache = new Map<string, Intl.NumberFormat>()
function formatter(currency: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = currency + JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: 'currency', currency, ...opts })
    fmtCache.set(key, f)
  }
  return f
}

/** "€35.00" — or "€35" when the amount is whole and `compact` is set. */
export function formatMoney(
  cents: number,
  currency = 'EUR',
  { compact = false, sign = false }: { compact?: boolean; sign?: boolean } = {},
): string {
  const whole = cents % 100 === 0
  const out = formatter(currency, {
    minimumFractionDigits: compact && whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100)
  if (sign && cents > 0) return '+' + out
  if (cents < 0) return '−' + out
  return out
}

/** Just the currency symbol for the active currency, e.g. "€". */
export function currencySymbol(currency = 'EUR'): string {
  const parts = formatter(currency, {}).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}
