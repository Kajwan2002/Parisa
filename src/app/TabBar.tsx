import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { usePlansSummary } from '@/db/queries'

interface TabBarProps {
  onAdd: () => void
}

const tabs = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/plans', label: 'Plans', icon: PlanIcon },
  { to: '/insights', label: 'Insights', icon: SparkIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
]

export function TabBar({ onAdd }: TabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto mx-3 mb-3 flex w-full max-w-md items-center justify-around rounded-[1.75rem] bg-surface/95 px-2 py-2 shadow-soft backdrop-blur">
        {tabs.slice(0, 3).map((t) => (
          <Tab key={t.to} {...t} />
        ))}

        <button
          type="button"
          onClick={onAdd}
          aria-label="Add expense"
          className="mx-1 grid h-14 w-14 shrink-0 -translate-y-3 place-items-center rounded-full bg-rose text-white shadow-soft active:scale-95"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>

        {tabs.slice(3).map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}

const PLAN_R = 8
const PLAN_C = 2 * Math.PI * PLAN_R

/**
 * The plans icon is a live progress ring, filling clockwise as what you owe gets
 * paid off, with a dot on it while something is overdue. Three states:
 * no plans at all is a plain circle, anything part-paid is a part ring, and
 * everything paid off closes it completely.
 */
function PlanIcon({ active }: { active: boolean }) {
  const plans = usePlansSummary()
  const progress = plans?.progress ?? 0
  const overdue = (plans?.overdueCount ?? 0) > 0

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r={PLAN_R}
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        opacity={active ? 0.3 : 0.25}
      />
      {progress > 0 && (
        <circle
          cx="12"
          cy="12"
          r={PLAN_R}
          stroke="currentColor"
          strokeWidth={active ? 2.8 : 2.2}
          strokeLinecap="round"
          strokeDasharray={`${PLAN_C * progress} ${PLAN_C}`}
          transform="rotate(-90 12 12)"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      )}
      {overdue && <circle cx="19.5" cy="4.5" r="3" fill="var(--color-over)" />}
    </svg>
  )
}

function Tab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: (p: { active: boolean }) => ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex flex-1 flex-col items-center gap-0.5 py-1"
      aria-label={label}
    >
      {({ isActive }) => (
        <>
          <Icon active={isActive} />
          <span
            className={cn(
              'text-[0.62rem] font-bold',
              isActive ? 'text-rose-deep' : 'text-ink-faint',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function base(active: boolean) {
  return cn('transition-colors', active ? 'text-rose' : 'text-ink-faint')
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <path
        d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-5h-6v5H5a1 1 0 01-1-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 004 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M3.5 4.5V8H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <path
        d="M12 3l2.2 5.2L20 10l-5.8 1.8L12 17l-2.2-5.2L4 10l5.8-1.8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  )
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 3l1.2 2.4 2.6-.6 1 2.5 2.5 1-.6 2.6L22 15l-2.4 1.2.6 2.6-2.5 1-1 2.5-2.6-.6L12 21l-1.2-2.4-2.6.6-1-2.5L4.7 15 2 12l2.4-1.2-.6-2.6 2.5-1 1-2.5 2.6.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity={0.4}
      />
    </svg>
  )
}
