import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** extra actions shown in the header, right side */
  headerRight?: ReactNode
}

const CLOSE_THRESHOLD = 90 // px dragged down before it dismisses
const EXIT_MS = 260

export function Sheet({ open, onClose, title, children, headerRight }: SheetProps) {
  const [offset, setOffset] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [settled, setSettled] = useState(false)
  const offsetRef = useRef(0)
  const dragging = useRef(false)
  const startY = useRef(0)

  useEffect(() => {
    if (!open) {
      setOffset(0)
      setExiting(false)
      setTouched(false)
      setSettled(false)
      offsetRef.current = 0
      dragging.current = false
      return
    }
    // failsafe: once the CSS entrance should be done, pin the sheet in place so
    // it can never get stuck mid-transition
    const settle = setTimeout(() => setSettled(true), 420)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(settle)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const isDragging = dragging.current

  // Entrance is pure CSS (`.sheet-panel` + `@starting-style`). We only take over
  // with an inline transform once the user has grabbed the sheet, or on exit.
  const panelStyle: CSSProperties = {}
  if (exiting) {
    panelStyle.transform = 'translateY(100%)'
  } else if (touched) {
    panelStyle.transform = `translateY(${offset}px)`
    if (isDragging) panelStyle.transition = 'none'
  } else if (settled) {
    panelStyle.transform = 'translateY(0)'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    dragging.current = true
    setTouched(true)
    startY.current = e.clientY
    offsetRef.current = 0
    setOffset(0)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointers */
    }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    const dy = Math.max(0, e.clientY - startY.current)
    offsetRef.current = dy
    setOffset(dy)
  }
  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    if (offsetRef.current > CLOSE_THRESHOLD) {
      setExiting(true)
      setTimeout(onClose, EXIT_MS)
    } else {
      offsetRef.current = 0
      setOffset(0)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25"
        style={{
          opacity: exiting ? 0 : Math.max(0, 1 - offset / 320),
          transition: isDragging ? 'none' : 'opacity 0.26s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-panel relative z-10 flex max-h-[92vh] flex-col rounded-t-[2rem] bg-bg shadow-[0_-8px_40px_-12px_rgba(217,101,145,0.35)]"
        style={panelStyle}
      >
        {/* draggable grabber + header */}
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex items-center gap-3 px-5 pt-3 pb-2">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-faint" />
          </div>
          {(title || headerRight) && (
            <div className="flex items-center justify-between gap-3 px-5 pb-2">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
              <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
                {headerRight}
              </div>
            </div>
          )}
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
