import { useState } from 'react'
import { Button } from '@/components/Button'
import { MoneyField } from '@/components/MoneyField'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/color'
import { CATEGORY_COLORS, CATEGORY_EMOJIS, DEFAULT_EMOJI } from '@/lib/palette'
import type { CategoryInput } from '@/db/repo'
import type { Category } from '@/db/types'

interface CategoryFormProps {
  initial?: Partial<Category>
  submitLabel?: string
  showBudget?: boolean
  currency?: string
  autoFocus?: boolean
  onSubmit: (input: CategoryInput) => void
  onCancel?: () => void
}

export function CategoryForm({
  initial,
  submitLabel = 'Save',
  showBudget = true,
  currency = 'EUR',
  autoFocus = true,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? DEFAULT_EMOJI)
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0])
  const [budget, setBudget] = useState<number>(initial?.monthlyBudget ?? 0)

  const canSave = name.trim().length > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        onSubmit({
          name,
          emoji,
          color,
          monthlyBudget: showBudget && budget > 0 ? budget : null,
        })
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl"
          style={{ background: withAlpha(color, 0.3) }}
        >
          {emoji}
        </div>
        <input
          autoFocus={autoFocus}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name (e.g. Rewe)"
          className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint"
        />
      </div>

      <div>
        <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">Icon</p>
        <div className="no-scrollbar grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-2xl bg-surface p-2 shadow-card">
          {dedupe([emoji, ...CATEGORY_EMOJIS]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                'grid h-9 place-items-center rounded-xl text-xl transition',
                e === emoji ? 'bg-blush ring-2 ring-rose' : 'active:bg-blush/60',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">Colour</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`colour ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                'h-8 w-8 rounded-full transition',
                c === color ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : '',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {showBudget && (
        <div>
          <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">
            Monthly budget <span className="font-medium text-ink-faint">(optional)</span>
          </p>
          <MoneyField cents={budget} onChange={setBudget} currency={currency} placeholder="No budget" />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" full onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" full disabled={!canSave}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)]
}
