import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { ExpenseSheet } from './ExpenseSheet'

interface ExpenseEditor {
  openNew: () => void
  openEdit: (id: string) => void
  /** edit a shared expense straight from its tab entry (used by the Tab page) */
  openEditTab: (tabEntryId: string) => void
}

const Ctx = createContext<ExpenseEditor>({
  openNew: () => {},
  openEdit: () => {},
  openEditTab: () => {},
})

export function useExpenseEditor() {
  return useContext(Ctx)
}

interface State {
  open: boolean
  editId: string | null
  editTabId: string | null
}

export function ExpenseEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false, editId: null, editTabId: null })

  const openNew = useCallback(() => setState({ open: true, editId: null, editTabId: null }), [])
  const openEdit = useCallback(
    (id: string) => setState({ open: true, editId: id, editTabId: null }),
    [],
  )
  const openEditTab = useCallback(
    (tabEntryId: string) => setState({ open: true, editId: null, editTabId: tabEntryId }),
    [],
  )
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const value = useMemo(() => ({ openNew, openEdit, openEditTab }), [openNew, openEdit, openEditTab])

  return (
    <Ctx.Provider value={value}>
      {children}
      <ExpenseSheet
        open={state.open}
        editId={state.editId}
        editTabId={state.editTabId}
        onClose={close}
      />
    </Ctx.Provider>
  )
}
