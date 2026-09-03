import { useState } from 'react'
import { Button } from '@/components/Button'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { cn } from '@/lib/cn'
import { todayStr } from '@/lib/dates'
import type { IncomeInput } from '@/db/repo'
import type { Income } from '@/db/types'

const PRESETS = ['Salary', 'From parents', 'Gift', 'Freelance', 'Refund', 'Other']

interface IncomeFormProps {
  initial?: Partial<Income>
  currency?: string
  submitLabel?: string
  onSubmit: (input: IncomeInput) => void
  onDelete?: () => void
}

export function IncomeForm({
  initial,
  currency = 'EUR',
  submitLabel = 'Add income',
  onSubmit,
  onDelete,
}: IncomeFormProps) {
  const [cents, setCents] = useState(initial?.amount ?? 0)
  const [source, setSource] = useState(initial?.source ?? 'Salary')
  const [receivedOn, setReceivedOn] = useState(initial?.receivedOn ?? todayStr())
  const [recurring, setRecurring] = useState(initial?.recurringMonthly ?? false)
  const [note, setNote] = useState(initial?.note ?? '')
  const custom = !PRESETS.includes(source)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (cents <= 0) return
        onSubmit({ amount: cents, source, receivedOn, recurringMonthly: recurring, note })
      }}
    >
      <MoneyKeypad cents={cents} onChange={setCents} currency={currency} />

      <div>
        <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Where from</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSource(p)}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-bold transition',
                source === p ? 'bg-rose text-white' : 'bg-surface text-ink-soft shadow-card',
              )}
            >
              {p}
            </button>
          ))}
        </div>
        {custom && (
          <input
            autoFocus
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Custom source"
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
          />
        )}
        <button
          type="button"
          onClick={() => setSource(custom ? 'Salary' : '')}
          className="mt-2 px-1 text-xs font-bold text-rose-deep"
        >
          {custom ? 'Use a preset' : 'Type a custom source'}
        </button>
      </div>

      <label className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
        <span className="font-bold text-ink">
          Every month
          <span className="block text-xs font-semibold text-ink-faint">
            Counts automatically each month from here on
          </span>
        </span>
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-6 w-6 accent-[var(--color-rose)]"
        />
      </label>

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">
          {recurring ? 'Starting from' : 'Date'}
        </span>
        <input
          type="date"
          value={receivedOn}
          onChange={(e) => setReceivedOn(e.target.value || todayStr())}
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
        />
      </label>

      <label>
        <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="optional"
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
