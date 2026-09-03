import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { CategoryBadge } from '@/components/CategoryBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { todayStr } from '@/lib/dates'
import { addCategory, addExpense, deleteExpense, updateExpense } from '@/db/repo'
import { useCategories, useExpense, useSettings } from '@/db/queries'
import { CategoryForm } from '@/features/categories/CategoryForm'

interface ExpenseSheetProps {
  open: boolean
  editId: string | null
  onClose: () => void
}

export function ExpenseSheet({ open, editId, onClose }: ExpenseSheetProps) {
  const toast = useToast()
  const categories = useCategories()
  const settings = useSettings()
  const editing = useExpense(editId)
  const currency = settings?.currency ?? 'EUR'

  const [cents, setCents] = useState(0)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [spentOn, setSpentOn] = useState(todayStr())
  const [note, setNote] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hydratedFor = useRef<string | null>(null)

  // reset / hydrate whenever the sheet opens
  useEffect(() => {
    if (!open) {
      hydratedFor.current = null
      return
    }
    if (editId && editing && hydratedFor.current !== editId) {
      setCents(editing.amount)
      setCategoryId(editing.categoryId)
      setSpentOn(editing.spentOn)
      setNote(editing.note)
      setCreatingCat(false)
      hydratedFor.current = editId
    }
    if (!editId && hydratedFor.current !== 'new') {
      setCents(0)
      setCategoryId(null)
      setSpentOn(todayStr())
      setNote('')
      setCreatingCat(false)
      hydratedFor.current = 'new'
    }
  }, [open, editId, editing])

  const canSave = cents > 0

  const sorted = useMemo(() => categories ?? [], [categories])

  async function save() {
    if (!canSave) return
    if (editId) {
      await updateExpense(editId, { amount: cents, categoryId, spentOn, note })
      toast('Saved 💕')
    } else {
      await addExpense({ amount: cents, categoryId, spentOn, note })
      toast('Added 💕')
    }
    onClose()
  }

  async function remove() {
    if (!editId) return
    await deleteExpense(editId)
    setConfirmDelete(false)
    toast('Deleted')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editId ? 'Edit expense' : 'Add expense'}
      headerRight={
        editId ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full bg-over/15 px-3 py-1.5 text-xs font-bold text-over"
          >
            Delete
          </button>
        ) : null
      }
    >
      {creatingCat ? (
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
      ) : (
        <div className="flex flex-col gap-5">
          <MoneyKeypad cents={cents} onChange={setCents} currency={currency} />

          <div>
            <p className="mb-2 px-1 text-xs font-bold text-ink-soft">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {sorted.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl p-2 transition',
                    categoryId === c.id ? 'bg-blush ring-2 ring-rose' : 'active:bg-blush/50',
                  )}
                >
                  <CategoryBadge category={c} size={40} />
                  <span className="line-clamp-1 text-[0.65rem] font-semibold text-ink">
                    {c.name}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreatingCat(true)}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-ink-faint p-2 text-ink-soft active:bg-blush/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blush text-xl">＋</span>
                <span className="text-[0.65rem] font-semibold">New</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Date</span>
              <input
                type="date"
                value={spentOn}
                max={todayStr()}
                onChange={(e) => setSpentOn(e.target.value || todayStr())}
                className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
              />
            </label>
          </div>

          <label>
            <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rewe, weekly shop"
              className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none placeholder:text-ink-faint"
            />
          </label>

          <Button full disabled={!canSave} onClick={save}>
            {editId ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this expense?"
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  )
}
