import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { currentMonthKey, monthLabel, shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { db } from '@/db/db'
import { addIncome, deleteIncome, updateIncome } from '@/db/repo'
import { incomeForMonth, useSettings } from '@/db/queries'
import type { Income } from '@/db/types'
import { IncomeForm } from './IncomeForm'

export function IncomePage() {
  const toast = useToast()
  const settings = useSettings()
  const currency = settings?.currency ?? 'EUR'
  const monthKey = currentMonthKey()

  const rows = useLiveQuery(
    () => db.income.orderBy('receivedOn').reverse().toArray(),
    [],
  )

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)

  const monthTotal = rows ? incomeForMonth(rows, monthKey) : 0
  const recurring = (rows ?? []).filter((r) => r.recurringMonthly)
  const oneOff = (rows ?? []).filter((r) => !r.recurringMonthly)

  return (
    <Screen title="Income" back="/">
      <Card className="flex flex-col items-center gap-1 py-6">
        <p className="text-xs font-bold text-ink-soft">income · {monthLabel(monthKey)}</p>
        <p className="text-4xl font-extrabold text-ink tabular-nums">
          {formatMoney(monthTotal, currency, { compact: true })}
        </p>
        {recurring.length > 0 && (
          <p className="text-xs font-semibold text-ink-faint">
            includes {formatMoney(
              recurring.reduce((s, r) => s + r.amount, 0),
              currency,
              { compact: true },
            )}{' '}
            recurring
          </p>
        )}
      </Card>

      {rows && rows.length === 0 && (
        <Card>
          <EmptyState
            emoji="💌"
            title="No income added yet"
            hint="Add your salary, money from your parents, or a gift."
          />
        </Card>
      )}

      {recurring.length > 0 && (
        <section>
          <SectionTitle>Every month</SectionTitle>
          <div className="mt-1 flex flex-col gap-2">
            {recurring.map((r) => (
              <IncomeRow key={r.id} row={r} currency={currency} onClick={() => setEditing(r)} />
            ))}
          </div>
        </section>
      )}

      {oneOff.length > 0 && (
        <section>
          <SectionTitle>One-off</SectionTitle>
          <div className="mt-1 flex flex-col gap-2">
            {oneOff.map((r) => (
              <IncomeRow key={r.id} row={r} currency={currency} onClick={() => setEditing(r)} />
            ))}
          </div>
        </section>
      )}

      <Button variant="soft" full onClick={() => setAdding(true)}>
        ＋ Add income
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add income">
        <IncomeForm
          currency={currency}
          onSubmit={async (input) => {
            await addIncome(input)
            setAdding(false)
            toast('Income added 🌷')
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit income">
        {editing && (
          <IncomeForm
            key={editing.id}
            initial={editing}
            currency={currency}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateIncome(editing.id, input)
              setEditing(null)
              toast('Saved 💕')
            }}
            onDelete={async () => {
              await deleteIncome(editing.id)
              setEditing(null)
              toast('Deleted')
            }}
          />
        )}
      </Sheet>
    </Screen>
  )
}

function IncomeRow({
  row,
  currency,
  onClick,
}: {
  row: Income
  currency: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint/30 text-lg">
        💶
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{row.source}</p>
        <p className="truncate text-xs font-semibold text-ink-faint">
          {row.recurringMonthly ? 'Monthly' : shortDate(row.receivedOn)}
          {row.note ? ` · ${row.note}` : ''}
        </p>
      </div>
      <span className="shrink-0 font-extrabold text-ink tabular-nums">
        {formatMoney(row.amount, currency, { compact: true })}
      </span>
    </button>
  )
}
