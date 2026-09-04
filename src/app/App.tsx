import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { getSettings } from '@/db/repo'
import { materializeRecurring } from '@/db/recurring'
import { ensureSeeded } from '@/db/seed'
import { useSettings } from '@/db/queries'
import { BudgetsPage } from '@/features/budgets/BudgetsPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ExpenseEditorProvider, useExpenseEditor } from '@/features/expenses/ExpenseEditorProvider'
import { HistoryPage } from '@/features/history/HistoryPage'
import { IncomePage } from '@/features/income/IncomePage'
import { InsightsPage } from '@/features/insights/InsightsPage'
import { RecurringPage } from '@/features/recurring/RecurringPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TabPage } from '@/features/tab/TabPage'
import { APP_NAME, activeTheme, applyAccent } from '@/theme/apply'
import { TabBar } from './TabBar'

export function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      await ensureSeeded()
      const s = await getSettings()
      applyAccent(s.themeAccent)
      setReady(true)
      void materializeRecurring()
    })()

    // catch up recurring payments when the app is re-opened / refocused
    const onVisible = () => {
      if (document.visibilityState === 'visible') void materializeRecurring()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!ready) return <Splash />

  return (
    <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ExpenseEditorProvider>
          <AccentSync />
          <Shell />
        </ExpenseEditorProvider>
      </BrowserRouter>
    </ToastProvider>
  )
}

function Shell() {
  const { openNew } = useExpenseEditor()
  return (
    <div className="min-h-dvh bg-bg">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/categories" element={<CategoriesPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/tab" element={<TabPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar onAdd={openNew} />
      <ScrollReset />
    </div>
  )
}

function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AccentSync() {
  const settings = useSettings()
  useEffect(() => {
    if (settings) applyAccent(settings.themeAccent)
  }, [settings])
  return null
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        {activeTheme.splashEmoji && <div className="text-5xl">{activeTheme.splashEmoji}</div>}
        <p className="text-sm font-bold text-ink-soft">{APP_NAME}</p>
      </div>
    </div>
  )
}
