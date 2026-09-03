import { useState } from 'react'
import { Button } from '@/components/Button'
import { CategoryGrid } from '@/components/CategoryGrid'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { todayStr } from '@/lib/dates'
import { addCategory } from '@/db/repo'
import { useCategories } from '@/db/queries'
import type { RecurringInput } from '@/db/recurring'
import type { RecurUnit, Recurring } from '@/db/types'
import { CategoryForm } from '@/features/categories/CategoryForm'

interface Preset {
  label: string
  count: number
  unit: RecurUnit
}

const PRESETS: Preset[] = [
  { label: 'Weekly', count: 1, unit: 'week' },
  { label: 'Monthly', count: 1, unit: 'month' },
  { label: 'Every 3 months', count: 3, unit: 'month' },
  { label: 'Every 6 months', count: 6, unit: 'month' },
  { label: 'Yearly', count: 12, unit: 'month' },
]

interface RecurringFormProps {
  initial?: Partial<Recurring>
  currency?: string
  submitLabel?: string
  onSubmit: (input: RecurringInput) => void
  onDelete?: () => void
}

export function RecurringForm({
  initial,
  currency = 'EUR',
  submitLabel = 'Add payment',
  onSubmit,
  onDelete,
}: RecurringFormProps) {
  const toast = useToast()
  const categories = useCategories()

  const [cents, setCents] = useState(initial?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null)
  const [count, setCount] = useState(initial?.everyCount ?? 1)
  const [unit, setUnit] = useState<RecurUnit>(initial?.everyUnit ?? 'month')
  const [anchorDate, setAnchorDate] = useState(initial?.anchorDate ?? todayStr())
  const [hasEnd, setHasEnd] = useState(!!initial?.endDate)
  const [endDate, setEndDate] = useState(initial?.endDate ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [creatingCat, setCreatingCat] = useState(false)

  const activePreset = PRESETS.find((p) => p.count === count && p.unit === unit)
  const custom = !activePreset

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
        if (cents <= 0) return
        onSubmit({
          amount: cents,
          categoryId,
          note,
          everyCount: Math.max(1, count),
          everyUnit: unit,
          anchorDate,
          endDate: hasEnd ? endDate : null,
        })
      }}
    >
      <MoneyKeypad cents={cents} onChange={setCents} currency={currency} />

      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Category</p>
        <CategoryGrid
          categories={categories ?? []}
          value={categoryId}
          onChange={setCategoryId}
          onCreateNew={() => setCreatingCat(true)}
        />
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Repeats</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setCount(p.count)
                setUnit(p.unit)
              }}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-bold transition',
                activePreset?.label === p.label
                  ? 'bg-rose text-white'
                  : 'bg-surface text-ink-soft shadow-card',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCount(2)
              setUnit('month')
            }}
            className={cn(
              'rounded-full px-3.5 py-2 text-sm font-bold transition',
              custom ? 'bg-rose text-white' : 'bg-surface text-ink-soft shadow-card',
            )}
          >
            Custom
          </button>
        </div>

        {custom && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-ink-soft">every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="w-16 rounded-2xl bg-surface px-3 py-2 text-center font-bold text-ink shadow-card outline-none"
            />
            <div className="flex rounded-full bg-blush/70 p-1">
              {(['week', 'month'] as RecurUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-bold transition',
                    unit === u ? 'bg-surface text-rose-deep shadow-card' : 'text-ink-soft',
                  )}
                >
                  {u}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">First payment</span>
        <input
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value || todayStr())}
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
        />
        <span className="mt-1 block px-1 text-[0.7rem] font-semibold text-ink-faint">
          Payments are added to your history from this date onward.
        </span>
      </label>

      <label className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
        <span className="font-bold text-ink">Has an end date</span>
        <input
          type="checkbox"
          checked={hasEnd}
          onChange={(e) => setHasEnd(e.target.checked)}
          className="h-6 w-6 accent-[var(--color-rose)]"
        />
      </label>
      {hasEnd && (
        <input
          type="date"
          value={endDate}
          min={anchorDate}
          onChange={(e) => setEndDate(e.target.value || todayStr())}
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
        />
      )}

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Name</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. iCloud, Netflix, gym"
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint"
        />
      </label>

      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="danger" full onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button type="submit" full disabled={cents <= 0}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
