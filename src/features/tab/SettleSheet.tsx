import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { MoneyKeypad } from '@/components/MoneyKeypad'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { todayStr } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { addSettlement } from '@/db/repo'
import { cheer } from '@/theme/apply'
import type { TabParty } from '@/db/types'

interface SettleSheetProps {
  open: boolean
  onClose: () => void
  net: number // + = partner owes you
  partnerName: string
  currency: string
}

export function SettleSheet({ open, onClose, net, partnerName, currency }: SettleSheetProps) {
  const toast = useToast()
  const [by, setBy] = useState<TabParty>(net < 0 ? 'you' : 'partner')
  const [cents, setCents] = useState(Math.abs(net))
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const hydrated = useRef(false)

  useEffect(() => {
    if (!open) {
      hydrated.current = false
      return
    }
    if (!hydrated.current) {
      setBy(net < 0 ? 'you' : 'partner')
      setCents(Math.abs(net))
      setDate(todayStr())
      setNote('')
      hydrated.current = true
    }
  }, [open, net])

  const direction =
    net > 0
      ? `${partnerName} owes you ${formatMoney(net, currency, { compact: true })}`
      : net < 0
        ? `You owe ${partnerName} ${formatMoney(-net, currency, { compact: true })}`
        : 'The tab is settled'

  async function save() {
    if (cents <= 0) return
    await addSettlement({ amount: cents, by, date, note })
    toast(cheer('Settled up 🤝'))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settle up">
      <div className="flex flex-col gap-5">
        <p className="text-center text-sm font-bold text-ink-soft">{direction}</p>

        <Segmented
          options={[
            { value: 'partner', label: `${partnerName} paid you` },
            { value: 'you', label: `You paid ${partnerName}` },
          ]}
          value={by}
          onChange={(v) => setBy(v as TabParty)}
        />

        <MoneyKeypad cents={cents} onChange={setCents} currency={currency} />

        <label>
          <span className="mb-2 block px-1 text-xs font-bold text-ink-soft">Date</span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value || todayStr())}
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

        <Button full disabled={cents <= 0} onClick={save}>
          Log settlement
        </Button>
      </div>
    </Sheet>
  )
}
