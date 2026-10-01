import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { MoneyField } from '@/components/MoneyField'
import { Segmented } from '@/components/Segmented'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { currentMonthKey, monthLabel } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { updateSettings } from '@/db/repo'
import { useDashboard, useSettings } from '@/db/queries'
import { cheer } from '@/theme/apply'

/**
 * The running balance, and a way to correct it. What gets stored is the figure
 * for the *start* of this month, back-solved from what the user types, so the
 * dashboard immediately shows exactly the number they entered.
 */
export function BalanceCard() {
  const toast = useToast()
  const settings = useSettings()
  const monthKey = currentMonthKey()
  const summary = useDashboard(monthKey)
  const currency = settings?.currency ?? 'EUR'

  const [amount, setAmount] = useState(0)
  const [sign, setSign] = useState<'plus' | 'minus'>('plus')
  const [editing, setEditing] = useState(false)

  const balance = summary?.balance ?? null
  const negative = balance != null && balance < 0

  async function save() {
    if (!summary) return
    const typed = sign === 'minus' ? -amount : amount
    // balance = startingBalance + income − spent, so solve for startingBalance
    const startOfMonth = typed - summary.income + summary.spent
    await updateSettings({ startingBalance: startOfMonth, balanceAnchor: monthKey })
    setEditing(false)
    setAmount(0)
    setSign('plus')
    toast(cheer('Balance updated 💕'))
  }

  return (
    <section>
      <SectionTitle>Balance</SectionTitle>
      <Card className="mt-1 flex flex-col gap-3">
        <div>
          <p className="text-xs font-bold text-ink-soft">
            {negative ? 'overdrawn' : 'left right now'}
          </p>
          <p
            className={cn(
              'text-2xl font-extrabold tabular-nums',
              negative ? 'text-over' : 'text-ink',
            )}
          >
            {balance == null
              ? '—'
              : formatMoney(Math.abs(balance), currency, { compact: true })}
          </p>
        </div>

        <p className="text-sm text-ink-soft">
          Whatever is left at the end of a month — or overdrawn — carries into the next one, so
          nothing resets on the 1st.
        </p>

        {editing ? (
          <>
            <div>
              <p className="mb-1.5 px-1 text-xs font-bold text-ink-soft">
                What’s actually in your account right now?
              </p>
              <MoneyField cents={amount} onChange={setAmount} currency={currency} />
            </div>
            <Segmented
              options={[
                { value: 'plus', label: 'In the account' },
                { value: 'minus', label: 'Overdrawn' },
              ]}
              value={sign}
              onChange={setSign}
            />
            <p className="px-1 text-xs font-semibold text-ink-faint">
              Counted from {monthLabel(monthKey)} onwards. Earlier months stay as they are in
              History.
            </p>
            <div className="flex gap-2">
              <Button full onClick={save}>
                Save balance
              </Button>
              <Button variant="ghost" full onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <Button variant="soft" full onClick={() => setEditing(true)}>
            Correct the balance
          </Button>
        )}
      </Card>
    </section>
  )
}
