import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { ExpenseSheet } from './ExpenseSheet'

interface ExpenseEditor {
  openNew: () => void
  openEdit: (id: string) => void
}

const Ctx = createContext<ExpenseEditor>({ openNew: () => {}, openEdit: () => {} })

export function useExpenseEditor() {
  return useContext(Ctx)
}

export function ExpenseEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  })

  const openNew = useCallback(() => setState({ open: true, editId: null }), [])
  const openEdit = useCallback((id: string) => setState({ open: true, editId: id }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const value = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit])

  return (
    <Ctx.Provider value={value}>
      {children}
      <ExpenseSheet open={state.open} editId={state.editId} onClose={close} />
    </Ctx.Provider>
  )
}
