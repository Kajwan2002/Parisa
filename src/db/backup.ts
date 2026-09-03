import { format } from 'date-fns'
import { db } from './db'
import { updateSettings } from './repo'
import type { Category, Expense, Income, Recurring, Settings } from './types'

const BACKUP_VERSION = 2

export interface BackupFile {
  app: 'parisa'
  version: number
  exportedAt: string
  data: {
    categories: Category[]
    expenses: Expense[]
    income: Income[]
    recurring?: Recurring[]
    settings: Settings[]
  }
}

export async function buildBackup(): Promise<BackupFile> {
  const [categories, expenses, income, recurring, settings] = await Promise.all([
    db.categories.toArray(),
    db.expenses.toArray(),
    db.income.toArray(),
    db.recurring.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: 'parisa',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { categories, expenses, income, recurring, settings },
  }
}

function backupFilename(): string {
  return `parisa-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
}

/**
 * Save a backup. On iOS this offers the share sheet ("Save to Files" →
 * iCloud Drive); elsewhere it downloads the file.
 */
export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const filename = backupFilename()
  const file = new File([json], filename, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Parisa backup' })
      await updateSettings({ lastBackupAt: Date.now() })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      // fall through to download
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  await updateSettings({ lastBackupAt: Date.now() })
  return 'downloaded'
}

export interface ImportResult {
  categories: number
  expenses: number
  income: number
}

function isBackup(v: unknown): v is BackupFile {
  if (!v || typeof v !== 'object') return false
  const b = v as Record<string, unknown>
  return b.app === 'parisa' && typeof b.version === 'number' && !!b.data
}

/** Replace all local data with the contents of a backup file. */
export async function importBackup(text: string): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isBackup(parsed)) throw new Error('That doesn’t look like a Parisa backup.')

  const { categories, expenses, income, recurring, settings } = parsed.data

  await db.transaction(
    'rw',
    db.categories,
    db.expenses,
    db.income,
    db.recurring,
    db.settings,
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.expenses.clear(),
        db.income.clear(),
        db.recurring.clear(),
        db.settings.clear(),
      ])
      if (categories?.length) await db.categories.bulkAdd(categories)
      if (expenses?.length) await db.expenses.bulkAdd(expenses)
      if (income?.length) await db.income.bulkAdd(income)
      if (recurring?.length) await db.recurring.bulkAdd(recurring)
      if (settings?.length) await db.settings.bulkAdd(settings)
    },
  )

  return {
    categories: categories?.length ?? 0,
    expenses: expenses?.length ?? 0,
    income: income?.length ?? 0,
  }
}

/** Wipe everything and re-seed from scratch. */
export async function wipeAll(): Promise<void> {
  await db.transaction(
    'rw',
    db.categories,
    db.expenses,
    db.income,
    db.recurring,
    db.settings,
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.expenses.clear(),
        db.income.clear(),
        db.recurring.clear(),
        db.settings.clear(),
      ])
    },
  )
}
