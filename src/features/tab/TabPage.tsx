import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CategoryBadge } from '@/components/CategoryBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DonutChart } from '@/components/DonutChart'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { deleteSettlement } from '@/db/repo'
import { useActiveTheme, useCategoryMap, useSettings, useTabSummary } from '@/db/queries'
import { cheer } from '@/theme/apply'
import type { TabEntryView } from '@/db/queries'
import type { Category, TabSettlement } from '@/db/types'
import { useExpenseEditor } from '@/features/expenses/ExpenseEditorProvider'
import { SettleSheet } from './SettleSheet'

type Row =
  | { kind: 'entry'; date: string; sort: number; entry: TabEntryView }
  | { kind: 'settle'; date: string; sort: number; settle: TabSettlement }

export function TabPage() {
  const toast = useToast()
  const tab = useTabSummary()
  const catMap = useCategoryMap()
  const settings = useSettings()
  const t = useActiveTheme()
  const currency = settings?.currency ?? 'EUR'
  const { openEditTab } = useExpenseEditor()

  const [settling, setSettling] = useState(false)
  const [deleteSettle, setDeleteSettle] = useState<string | null>(null)

  const partner = tab?.partnerName?.trim() || 'Partner'

  const rows = useMemo<Row[]>(() => {
    if (!tab) return []
    const es: Row[] = tab.entries.map((e) => ({
      kind: 'entry',
      date: e.date,
      sort: e.createdAt,
      entry: e,
    }))
    const ss: Row[] = tab.settlements.map((s) => ({
      kind: 'settle',
      date: s.date,
      sort: s.createdAt,
      settle: s,
    }))
    return [...es, ...ss].sort((a, b) => b.date.localeCompare(a.date) || b.sort - a.sort)
  }, [tab])

  if (!tab) {
    return (
      <Screen title="Shared tab" back="/settings">
        <div className="h-52 animate-pulse rounded-3xl bg-surface/60" />
      </Screen>
    )
  }

  const { net } = tab
  const grossToYou = tab.entries
    .filter((e) => e.paidBy === 'you')
    .reduce((s, e) => s + e.outstanding, 0)
  const grossByYou = tab.entries
    .filter((e) => e.paidBy === 'partner')
    .reduce((s, e) => s + e.outstanding, 0)

  const headline =
    net > 0
      ? `${partner} owes you`
      : net < 0
        ? `You owe ${partner}`
        : cheer('All settled ✨')

  const hasAnything = tab.entries.length > 0 || tab.settlements.length > 0

  return (
    <Screen title="Shared tab" back="/settings">
      <Card className="flex flex-col items-center gap-4 py-6">
        <DonutChart
          slices={[
            { label: 'owed to you', value: grossToYou, color: 'var(--color-good)' },
            { label: 'you owe', value: grossByYou, color: 'var(--color-over)' },
          ]}
          size={188}
          thickness={22}
        >
          <div>
            <p className="text-xs font-bold text-ink-soft">{headline}</p>
            {net !== 0 && (
              <p className="text-2xl font-extrabold text-ink tabular-nums">
                {formatMoney(Math.abs(net), currency, { compact: true })}
              </p>
            )}
          </div>
        </DonutChart>

        {(grossToYou > 0 || grossByYou > 0) && (
          <div className="flex gap-4 text-center text-xs font-bold">
            <span className="text-good">
              {partner} owes {formatMoney(grossToYou, currency, { compact: true })}
            </span>
            <span className="text-over">
              you owe {formatMoney(grossByYou, currency, { compact: true })}
            </span>
          </div>
        )}

        {hasAnything && (
          <Button full onClick={() => setSettling(true)}>
            Settle up
          </Button>
        )}
      </Card>

      {!hasAnything ? (
        <Card>
          <EmptyState
            emoji={t.emptyIcon.tab}
            title="Nothing on the tab"
            hint={`When you add an expense, flip "Split with ${partner}" to put a share on the tab.`}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) =>
            r.kind === 'entry' ? (
              <EntryRow
                key={r.entry.id}
                entry={r.entry}
                partner={partner}
                currency={currency}
                category={
                  r.entry.categoryId ? (catMap?.get(r.entry.categoryId) ?? null) : null
                }
                onClick={() => openEditTab(r.entry.id)}
              />
            ) : (
              <button
                key={r.settle.id}
                type="button"
                onClick={() => setDeleteSettle(r.settle.id)}
                className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint/30 text-lg">
                  🤝
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">
                    {r.settle.by === 'partner'
                      ? `${partner} paid you`
                      : `You paid ${partner}`}
                  </p>
                  <p className="truncate text-xs font-semibold text-ink-faint">
                    {shortDate(r.settle.date)}
                    {r.settle.note ? ` · ${r.settle.note}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-extrabold text-good tabular-nums">
                  {formatMoney(r.settle.amount, currency, { compact: true })}
                </span>
              </button>
            ),
          )}
        </div>
      )}

      <SettleSheet
        open={settling}
        onClose={() => setSettling(false)}
        net={net}
        partnerName={partner}
        currency={currency}
      />

      <ConfirmDialog
        open={deleteSettle !== null}
        title="Delete this settlement?"
        message="The tab balance will go back up by this amount."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteSettle) await deleteSettlement(deleteSettle)
          setDeleteSettle(null)
          toast('Settlement removed')
        }}
        onCancel={() => setDeleteSettle(null)}
      />
    </Screen>
  )
}

function EntryRow({
  entry,
  partner,
  currency,
  category,
  onClick,
}: {
  entry: TabEntryView
  partner: string
  currency: string
  category: Category | null
  onClick: () => void
}) {
  const debt = entry.paidBy === 'you' ? entry.partnerShare : entry.yourShare
  const done = entry.outstanding <= 0
  const partial = !done && entry.clearedAmount > 0
  const dirText =
    entry.paidBy === 'you' ? `you paid · ${partner} owes` : `${partner} paid · you owe`
  const money = (c: number) => formatMoney(c, currency, { compact: true })

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left shadow-card active:opacity-80',
        done && 'opacity-55',
      )}
    >
      <CategoryBadge category={category} size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-bold text-ink">
          {done && <span className="text-good">✓</span>}
          <span className="truncate">{entry.note || category?.name || 'Shared expense'}</span>
        </p>
        <p className="truncate text-xs font-semibold text-ink-faint">
          {shortDate(entry.date)} · {dirText}
          {partial ? ` · ${money(entry.clearedAmount)} settled` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            'block font-extrabold tabular-nums',
            done
              ? 'text-ink-faint'
              : entry.paidBy === 'you'
                ? 'text-good'
                : 'text-over',
          )}
        >
          {money(done ? debt : entry.outstanding)}
        </span>
        {partial && <span className="text-[0.6rem] font-bold text-ink-faint">of {money(debt)}</span>}
      </div>
    </button>
  )
}
