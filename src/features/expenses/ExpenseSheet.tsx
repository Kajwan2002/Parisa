import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { CategoryBadge } from '@/components/CategoryBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { SplitSlider } from '@/components/SplitSlider'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { todayStr } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import {
  addCategory,
  addExpense,
  addSharedExpense,
  deleteExpense,
  deleteSharedExpense,
  updateExpense,
  updateSharedExpense,
} from '@/db/repo'
import { useCategories, useExpense, useSettings, useTabEntry } from '@/db/queries'
import { cheer } from '@/theme/apply'
import type { TabParty } from '@/db/types'
import { CategoryForm } from '@/features/categories/CategoryForm'

interface ExpenseSheetProps {
  open: boolean
  editId: string | null
  editTabId: string | null
  onClose: () => void
}

export function ExpenseSheet({ open, editId, editTabId, onClose }: ExpenseSheetProps) {
  const toast = useToast()
  const categories = useCategories()
  const settings = useSettings()
  const editingExpense = useExpense(editId)
  const linkedTabId = editTabId ?? editingExpense?.tabEntryId ?? null
  const editingTab = useTabEntry(linkedTabId)
  const currency = settings?.currency ?? 'EUR'
  const partnerName = settings?.partnerName?.trim() || 'Partner'

  const anyEdit = editId ?? editTabId ?? null
  const isEditingShared = !!linkedTabId

  const [cents, setCents] = useState(0) // shared: total bill · else: the amount
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [spentOn, setSpentOn] = useState(todayStr())
  const [note, setNote] = useState('')
  const [shared, setShared] = useState(false)
  const [paidBy, setPaidBy] = useState<TabParty>('you')
  const [yourShare, setYourShare] = useState(0)
  const [creatingCat, setCreatingCat] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hydratedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      hydratedFor.current = null
      return
    }
    const key = anyEdit ?? 'new'
    if (isEditingShared && !editingTab) return
    if (!isEditingShared && editId && !editingExpense) return
    if (hydratedFor.current === key) return

    if (isEditingShared && editingTab) {
      setShared(true)
      setCents(editingTab.total)
      setYourShare(editingTab.yourShare)
      setPaidBy(editingTab.paidBy)
      setCategoryId(editingTab.categoryId)
      setSpentOn(editingTab.date)
      setNote(editingTab.note)
    } else if (editId && editingExpense) {
      setShared(false)
      setCents(editingExpense.amount)
      setCategoryId(editingExpense.categoryId)
      setSpentOn(editingExpense.spentOn)
      setNote(editingExpense.note)
    } else {
      setShared(false)
      setCents(0)
      setYourShare(0)
      setPaidBy('you')
      setCategoryId(null)
      setSpentOn(todayStr())
      setNote('')
    }
    setCreatingCat(false)
    hydratedFor.current = key
  }, [open, anyEdit, isEditingShared, editingTab, editingExpense, editId])

  const sorted = useMemo(() => categories ?? [], [categories])
  const clampedYourShare = Math.min(cents, Math.max(0, yourShare))
  const partnerShare = Math.max(0, cents - clampedYourShare)
  const canSave = cents > 0

  function toggleShared(v: boolean) {
    setShared(v)
    if (v && yourShare === 0) setYourShare(Math.round(cents / 2))
  }

  async function save() {
    if (!canSave) return
    if (shared) {
      const payload = {
        total: cents,
        yourShare: clampedYourShare,
        partnerShare,
        paidBy,
        categoryId,
        note,
        date: spentOn,
      }
      if (linkedTabId) await updateSharedExpense(linkedTabId, payload)
      else {
        if (editId) await deleteExpense(editId) // converted from a normal expense
        await addSharedExpense(payload)
      }
    } else {
      if (linkedTabId) {
        await deleteSharedExpense(linkedTabId) // converted back to a normal expense
        await addExpense({ amount: cents, categoryId, note, spentOn })
      } else if (editId) {
        await updateExpense(editId, { amount: cents, categoryId, spentOn, note })
      } else {
        await addExpense({ amount: cents, categoryId, note, spentOn })
      }
    }
    toast(cheer(anyEdit ? 'Saved 💕' : 'Added 💕'))
    onClose()
  }

  async function remove() {
    if (linkedTabId) await deleteSharedExpense(linkedTabId)
    else if (editId) await deleteExpense(editId)
    setConfirmDelete(false)
    toast('Deleted')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={anyEdit ? 'Edit expense' : 'Add expense'}
      headerRight={
        anyEdit ? (
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
          {shared && (
            <p className="-mb-2 text-center text-xs font-bold text-ink-soft">total bill</p>
          )}
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

          {/* shared / split */}
          <div>
            <label className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
              <span className="font-bold text-ink">
                Split with {partnerName}
                <span className="block text-xs font-semibold text-ink-faint">
                  Adds it to the shared tab
                </span>
              </span>
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => toggleShared(e.target.checked)}
                className="h-6 w-6 accent-[var(--color-rose)]"
              />
            </label>

            {shared && (
              <div className="mt-3 flex flex-col gap-3">
                <Segmented
                  options={[
                    { value: 'you', label: 'You paid' },
                    { value: 'partner', label: `${partnerName} paid` },
                  ]}
                  value={paidBy}
                  onChange={(v) => setPaidBy(v as TabParty)}
                />
                <SplitSlider
                  total={cents}
                  yourShare={clampedYourShare}
                  onChange={setYourShare}
                  currency={currency}
                  partnerName={partnerName}
                />
                <p className="px-1 text-xs font-semibold text-ink-faint">
                  {paidBy === 'you'
                    ? partnerShare > 0
                      ? `${partnerName} will owe you ${formatMoney(partnerShare, currency, { compact: true })}`
                      : 'Nothing goes on the tab'
                    : clampedYourShare > 0
                      ? `You'll owe ${partnerName} ${formatMoney(clampedYourShare, currency, { compact: true })}`
                      : 'Nothing goes on the tab'}
                </p>
              </div>
            )}
          </div>

          <label>
            <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Date</span>
            <input
              type="date"
              value={spentOn}
              max={todayStr()}
              onChange={(e) => setSpentOn(e.target.value || todayStr())}
              className="w-full rounded-2xl bg-surface px-4 py-3 font-semibold text-ink shadow-card outline-none"
            />
          </label>

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
            {anyEdit ? 'Save changes' : shared ? 'Add & split' : 'Add expense'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={isEditingShared ? 'Delete this shared expense?' : 'Delete this expense?'}
        message={
          isEditingShared
            ? 'It will be removed from your history and the tab.'
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  )
}
