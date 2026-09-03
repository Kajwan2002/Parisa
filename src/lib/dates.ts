import {
  addMonths,
  format,
  isSameDay,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns'

// Dates for expenses / income are stored as plain "YYYY-MM-DD" strings so
// there is never any timezone drift. A "month key" is the "YYYY-MM" prefix.

export type MonthKey = string // "2026-09"
export type YearKey = string // "2026"
export type DateStr = string // "2026-09-03"

export function todayStr(): DateStr {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toDateStr(d: Date): DateStr {
  return format(d, 'yyyy-MM-dd')
}

export function monthKeyOf(date: DateStr | Date): MonthKey {
  return typeof date === 'string' ? date.slice(0, 7) : format(date, 'yyyy-MM')
}

export function yearKeyOf(date: DateStr | Date): YearKey {
  return typeof date === 'string' ? date.slice(0, 4) : format(date, 'yyyy')
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(new Date())
}

export function currentYearKey(): YearKey {
  return yearKeyOf(new Date())
}

export function isCurrentMonth(key: MonthKey): boolean {
  return key === currentMonthKey()
}

/** step a "YYYY-MM" key by n months */
export function shiftMonth(key: MonthKey, n: number): MonthKey {
  return monthKeyOf(addMonths(parseISO(key + '-01'), n))
}

export function shiftYear(key: YearKey, n: number): YearKey {
  return String(Number(key) + n)
}

/** the 12 month keys of a year, Jan → Dec */
export function monthsOfYear(year: YearKey): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

export function monthLabel(key: MonthKey, style: 'long' | 'short' = 'long'): string {
  return format(parseISO(key + '-01'), style === 'long' ? 'MMMM yyyy' : 'MMM')
}

export function monthLabelNoYear(key: MonthKey): string {
  return format(parseISO(key + '-01'), 'MMMM')
}

export function dayHeading(date: DateStr): string {
  const d = parseISO(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMM')
}

export function shortDate(date: DateStr): string {
  return format(parseISO(date), 'd MMM yyyy')
}

export function daysInMonthKey(key: MonthKey): number {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate()
}

/** how many days to divide by for a fair "per day" average */
export function elapsedDaysInMonth(key: MonthKey): number {
  if (!isCurrentMonth(key)) return daysInMonthKey(key)
  return new Date().getDate()
}

export { isSameDay, parseISO }
