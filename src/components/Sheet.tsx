import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** extra actions shown in the header, right side */
  headerRight?: ReactNode
}

export function Sheet({ open, onClose, title, children, headerRight }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92vh] flex-col rounded-t-[2rem] bg-bg',
          'animate-sheet-up shadow-[0_-8px_40px_-12px_rgba(217,101,145,0.35)]',
        )}
      >
        <div className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-2">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-faint" />
        </div>
        {(title || headerRight) && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
            <div className="flex items-center gap-2">{headerRight}</div>
          </div>
        )}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
