import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useActiveTheme, useCategoryMap, useRecurring, useSettings } from '@/db/queries'
import { cheer } from '@/theme/apply'
import {
  addRecurring,
  deleteRecurring,
  describeInterval,
  monthlyEquivalent,
  nextChargeDate,
  setRecurringActive,
  updateRecurring,
} from '@/db/recurring'
import type { Recurring } from '@/db/types'
import { RecurringForm } from './RecurringForm'

export function RecurringPage() {
  const toast = useToast()
  const settings = useSettings()
  const currency = settings?.currency ?? 'EUR'
  const rules = useRecurring()
  const catMap = useCategoryMap()
  const t = useActiveTheme()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)

  const active = (rules ?? []).filter((r) => r.isActive)
  const perMonth = active.reduce((s, r) => s + monthlyEquivalent(r), 0)

  return (
    <Screen title="Recurring payments" back="/settings">
      {active.length > 0 && (
        <Card className="flex flex-col items-center gap-1 py-6">
          <p className="text-xs font-bold text-ink-soft">roughly per month</p>
          <p className="text-4xl font-extrabold text-ink tabular-nums">
            {formatMoney(Math.round(perMonth), currency, { compact: true })}
          </p>
          <p className="text-xs font-semibold text-ink-faint">
            across {active.length} payment{active.length === 1 ? '' : 's'}
          </p>
        </Card>
      )}

      {rules && rules.length === 0 && (
        <Card>
          <EmptyState
            emoji={t.emptyIcon.recurring}
            title="No recurring payments yet"
            hint="Add subscriptions like iCloud or Netflix and they'll be logged automatically on the day they're charged."
          />
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {(rules ?? []).map((r) => {
          const next = nextChargeDate(r)
          const cat = r.categoryId ? (catMap?.get(r.categoryId) ?? null) : null
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing(r)}
              className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80"
            >
              <CategoryBadge category={cat} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">
                  {r.note || cat?.name || 'Payment'}
                  {!r.isActive && (
                    <span className="ml-2 text-xs font-bold text-ink-faint">paused</span>
                  )}
                </p>
                <p className="truncate text-xs font-semibold text-ink-faint">
                  {describeInterval(r.everyCount, r.everyUnit)}
                  {r.isActive && next ? ` · next ${shortDate(next)}` : ''}
                  {r.isActive && !next ? ' · ended' : ''}
                </p>
              </div>
              <span className="shrink-0 font-extrabold text-ink tabular-nums">
                {formatMoney(r.amount, currency, { compact: true })}
              </span>
            </button>
          )
        })}
      </div>

      <Button variant="soft" full onClick={() => setAdding(true)}>
        ＋ Add recurring payment
      </Button>

      <p className="px-1 text-center text-xs font-semibold text-ink-faint">
        Charges are added to your history automatically each time you open the app.
      </p>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Recurring payment">
        <RecurringForm
          currency={currency}
          onSubmit={async (input) => {
            await addRecurring(input)
            setAdding(false)
            toast(cheer('Recurring payment added 🔁'))
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit recurring payment">
        {editing && (
          <div className="flex flex-col gap-3">
            <RecurringForm
              key={editing.id}
              initial={editing}
              currency={currency}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                await updateRecurring(editing.id, input)
                setEditing(null)
                toast(cheer('Saved 💕'))
              }}
              onDelete={async () => {
                await deleteRecurring(editing.id)
                setEditing(null)
                toast('Deleted · logged payments kept')
              }}
            />
            <Button
              variant="ghost"
              full
              onClick={async () => {
                await setRecurringActive(editing.id, !editing.isActive)
                setEditing(null)
                toast(editing.isActive ? 'Paused' : 'Resumed')
              }}
            >
              {editing.isActive ? 'Pause this payment' : 'Resume this payment'}
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
