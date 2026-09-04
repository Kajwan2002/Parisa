import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { formatMoney } from '@/lib/money'
import { addCategory, deleteCategory, reorderCategories, updateCategory } from '@/db/repo'
import { useActiveTheme, useCategories, useSettings } from '@/db/queries'
import { cheer } from '@/theme/apply'
import type { Category } from '@/db/types'
import { CategoryForm } from './CategoryForm'

export function CategoriesPage() {
  const toast = useToast()
  const categories = useCategories()
  const settings = useSettings()
  const t = useActiveTheme()
  const currency = settings?.currency ?? 'EUR'

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [reordering, setReordering] = useState(false)

  const move = async (index: number, dir: -1 | 1) => {
    if (!categories) return
    const next = [...categories]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    await reorderCategories(next.map((c) => c.id))
  }

  return (
    <Screen
      title="Categories"
      back="/settings"
      right={
        (categories?.length ?? 0) > 1 ? (
          <button
            type="button"
            onClick={() => setReordering((v) => !v)}
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-rose-deep shadow-card"
          >
            {reordering ? 'Done' : 'Reorder'}
          </button>
        ) : null
      }
    >
      {categories && categories.length === 0 && (
        <Card>
          <EmptyState emoji={t.emptyIcon.categories} title="No categories" hint="Add one to start sorting your spending." />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {(categories ?? []).map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 shadow-card"
          >
            <CategoryBadge category={c} size={44} />
            <button
              type="button"
              disabled={reordering}
              onClick={() => setEditing(c)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate font-bold text-ink">{c.name}</p>
              <p className="text-xs font-semibold text-ink-faint">
                {c.monthlyBudget
                  ? `${formatMoney(c.monthlyBudget, currency, { compact: true })} / month`
                  : 'No budget'}
              </p>
            </button>

            {reordering ? (
              <div className="flex flex-col">
                <Arrow dir="up" disabled={i === 0} onClick={() => move(i, -1)} />
                <Arrow
                  dir="down"
                  disabled={i === (categories?.length ?? 0) - 1}
                  onClick={() => move(i, 1)}
                />
              </div>
            ) : (
              <span className="text-ink-faint">›</span>
            )}
          </div>
        ))}
      </div>

      <Button variant="soft" full onClick={() => setAdding(true)}>
        ＋ New category
      </Button>

      {/* add */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="New category">
        <CategoryForm
          currency={currency}
          submitLabel="Add category"
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await addCategory(input)
            setAdding(false)
            toast(`${input.emoji} ${input.name} added`)
          }}
        />
      </Sheet>

      {/* edit */}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit category">
        {editing && (
          <EditCategoryBody
            category={editing}
            currency={currency}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Screen>
  )
}

function EditCategoryBody({
  category,
  currency,
  onDone,
}: {
  category: Category
  currency: string
  onDone: () => void
}) {
  const toast = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (confirmingDelete) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        <p className="font-bold text-ink">Delete “{category.name}”?</p>
        <p className="text-sm text-ink-soft">
          What should happen to expenses already in this category?
        </p>
        <Button
          full
          onClick={async () => {
            await deleteCategory(category.id, 'reassign')
            toast('Category deleted · expenses moved to Other')
            onDone()
          }}
        >
          Move them to “Other”
        </Button>
        <Button
          variant="soft"
          full
          onClick={async () => {
            await deleteCategory(category.id, 'keep')
            toast('Category deleted · expenses kept')
            onDone()
          }}
        >
          Keep them uncategorised
        </Button>
        <Button variant="ghost" full onClick={() => setConfirmingDelete(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CategoryForm
        initial={category}
        currency={currency}
        submitLabel="Save changes"
        autoFocus={false}
        onSubmit={async (input) => {
          await updateCategory(category.id, input)
          toast(cheer('Saved 💕'))
          onDone()
        }}
      />
      <Button variant="danger" full onClick={() => setConfirmingDelete(true)}>
        Delete category
      </Button>
    </div>
  )
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: 'up' | 'down'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Move ${dir}`}
      className="grid h-7 w-8 place-items-center text-ink-soft disabled:opacity-25 active:scale-90"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
