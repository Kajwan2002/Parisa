import { useState } from 'react'
import { Button } from '@/components/Button'
import { CategoryGrid } from '@/components/CategoryGrid'
import { Segmented } from '@/components/Segmented'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { shortDate, todayStr } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { addCategory } from '@/db/repo'
import { useCategories } from '@/db/queries'
import { installmentAmounts, installmentDate, planKind, type PlanInput } from '@/db/plans'
import type { Plan, PlanKind, RecurUnit } from '@/db/types'
import { CategoryForm } from '@/features/categories/CategoryForm'

const EVERY: { label: string; count: number; unit: RecurUnit }[] = [
  { label: 'Monthly', count: 1, unit: 'month' },
  { label: 'Weekly', count: 1, unit: 'week' },
  { label: 'Every 2 months', count: 2, unit: 'month' },
  { label: 'Every 3 months', count: 3, unit: 'month' },
]

const COUNTS = [3, 4, 6, 10, 12, 24]

interface PlanFormProps {
  initial?: Partial<Plan>
  currency?: string
  submitLabel?: string
  onSubmit: (input: PlanInput) => void
}

export function PlanForm({
  initial,
  currency = 'EUR',
  submitLabel = 'Create plan',
  onSubmit,
}: PlanFormProps) {
  const toast = useToast()
  const categories = useCategories()

  const [kind, setKind] = useState<PlanKind>(initial ? planKind(initial) : 'fixed')
  const [total, setTotal] = useState(initial?.total ?? 0)
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null)
  const [count, setCount] = useState(initial?.count ?? 10)
  const [everyCount, setEveryCount] = useState(initial?.everyCount ?? 1)
  const [unit, setUnit] = useState<RecurUnit>(initial?.everyUnit ?? 'month')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [creatingCat, setCreatingCat] = useState(false)

  const fixed = kind === 'fixed'
  const activeEvery = EVERY.find((e) => e.count === everyCount && e.unit === unit)
  const per = fixed && total > 0 && count > 0 ? installmentAmounts(total, count) : []
  const lastDue =
    fixed && count > 0
      ? installmentDate({ startDate, everyUnit: unit, everyCount }, count - 1)
      : null

  if (creatingCat) {
    return (
      <div className="pt-1">
        <p className="mb-3 text-sm font-bold text-ink-soft">New category</p>
        <CategoryForm
          currency={currency}
          submitLabel="Add & select"
          onCancel={() => setCreatingCat(false)}
          onSubmit={async (input) => {
            const id = await addCategory(input)
            setCategoryId(id)
            setCreatingCat(false)
            toast(`${input.emoji} ${input.name} added`)
          }}
        />
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (total <= 0) return
        onSubmit({
          name,
          total,
          categoryId,
          kind,
          count,
          everyCount,
          everyUnit: unit,
          startDate,
          note,
        })
      }}
    >
      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Total to pay off</p>
        <MoneyKeypad cents={total} onChange={setTotal} currency={currency} />
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">How you pay it</p>
        <Segmented
          options={[
            { value: 'fixed', label: 'Set installments' },
            { value: 'open', label: 'Pay anytime' },
          ]}
          value={kind}
          onChange={setKind}
        />
        <p className="mt-2 px-1 text-xs font-semibold text-ink-faint">
          {fixed
            ? 'Fixed amounts on fixed dates — the app tells you when one is due.'
            : 'No schedule and no due dates. Pay whatever you like, whenever you like, and watch the total come down.'}
        </p>
      </div>

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">What is it for?</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Heating bill 2025"
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
        />
      </label>

      {fixed && (
        <>
          <div>
            <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Split into</p>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-sm font-bold transition',
                    count === c ? 'bg-rose text-white' : 'bg-blush/60 text-ink-soft',
                  )}
                >
                  {c}×
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={600}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                aria-label="Number of installments"
                className="w-20 rounded-full bg-surface px-3 py-2 text-center text-sm font-bold text-ink shadow-card outline-none focus:ring-2 focus:ring-rose-soft"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 px-1 text-xs font-bold text-ink-soft">One payment</p>
            <div className="flex flex-wrap gap-2">
              {EVERY.map((e) => (
                <button
                  key={e.label}
                  type="button"
                  onClick={() => {
                    setEveryCount(e.count)
                    setUnit(e.unit)
                  }}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-sm font-bold transition',
                    activeEvery?.label === e.label
                      ? 'bg-rose text-white'
                      : 'bg-blush/60 text-ink-soft',
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">
              First payment due
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none focus:ring-2 focus:ring-rose-soft"
            />
          </label>
        </>
      )}

      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Category</p>
        <CategoryGrid
          categories={categories ?? []}
          value={categoryId}
          onChange={setCategoryId}
          onCreateNew={() => setCreatingCat(true)}
        />
      </div>

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering"
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-rose-soft"
        />
      </label>

      {per.length > 0 && (
        <p className="rounded-2xl bg-blush/50 px-4 py-3 text-sm font-semibold text-ink-soft">
          {count}× {formatMoney(per[0], currency, { compact: true })}
          {per[per.length - 1] !== per[0] && (
            <> (last one {formatMoney(per[per.length - 1], currency, { compact: true })})</>
          )}
          {lastDue && <>, finishing {shortDate(lastDue)}</>}
        </p>
      )}

      <Button type="submit" full disabled={total <= 0}>
        {submitLabel}
      </Button>
    </form>
  )
}
