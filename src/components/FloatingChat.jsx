// =============================================================================
// FloatingChat.jsx — Draggable floating AI chat button + panel
// =============================================================================
// Sections:
//   1. Helpers      — clamp utility
//   2. FloatingChat — FAB with drag (mouse + touch), panel positioning
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import AIChat from './AIChat'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

// =============================================================================
// 1. HELPERS
// =============================================================================

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// =============================================================================
// 2. FLOATING CHAT
// =============================================================================

const PANEL_W = 340
const PANEL_H = 500
const BUTTON_SIZE = 48
const EDGE_PAD = 16

function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  // Default bottom-right anchor for the current viewport.
  const defaultPos = () => ({
    x: window.innerWidth - BUTTON_SIZE - EDGE_PAD,
    y: window.innerHeight - BUTTON_SIZE - EDGE_PAD,
  })

  // Position of the FAB (stored as distance from top-left). A saved position is
  // only used if it's a valid pair of finite numbers; it is clamped to the
  // current viewport below so a stale off-screen value can't hide the button.
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('floatingChat_pos'))
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved
    } catch {}
    return defaultPos()
  })

  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const hasMoved = useRef(false)
  const fabRef = useRef(null)

  // Clamp into the viewport on mount AND on resize. The mount clamp is the fix
  // for "the chat bubble disappeared": a position saved on a larger/rotated
  // screen (or a different device) could be off-screen for the current viewport,
  // and the resize handler alone never ran on load — so the FAB rendered outside
  // the visible area and looked gone.
  useEffect(() => {
    const reclamp = () => {
      setPos((p) => ({
        x: clamp(p.x, EDGE_PAD, window.innerWidth - BUTTON_SIZE - EDGE_PAD),
        y: clamp(p.y, EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD),
      }))
    }
    reclamp() // run once on mount
    window.addEventListener('resize', reclamp)
    return () => window.removeEventListener('resize', reclamp)
  }, [])

  // Single drag core — shared by the FAB (closed) and the panel header (open),
  // for both mouse and touch. Tracks the pointer, clamps into the viewport, and
  // persists the position on release. Replaces three near-identical copies.
  const startDrag = useCallback(
    (startX, startY, isTouch) => {
      dragging.current = true
      hasMoved.current = false
      dragStart.current = { mx: startX, my: startY, px: pos.x, py: pos.y }

      const moveTo = (clientX, clientY) => {
        if (!dragging.current) return
        const dx = clientX - dragStart.current.mx
        const dy = clientY - dragStart.current.my
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true
        setPos({
          x: clamp(dragStart.current.px + dx, EDGE_PAD, window.innerWidth - BUTTON_SIZE - EDGE_PAD),
          y: clamp(dragStart.current.py + dy, EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD),
        })
      }

      const moveEvt = isTouch ? 'touchmove' : 'mousemove'
      const endEvt = isTouch ? 'touchend' : 'mouseup'
      const onMove = (e) => {
        const p = isTouch ? e.touches[0] : e
        moveTo(p.clientX, p.clientY)
      }
      const onEnd = () => {
        dragging.current = false
        window.removeEventListener(moveEvt, onMove)
        window.removeEventListener(endEvt, onEnd)
        // setPos callback reads the live position — avoids a stale closure on pos
        setPos((p) => {
          try {
            sessionStorage.setItem('floatingChat_pos', JSON.stringify(p))
          } catch {}
          return p
        })
      }

      window.addEventListener(moveEvt, onMove, isTouch ? { passive: true } : undefined)
      window.addEventListener(endEvt, onEnd)
    },
    [pos]
  )

  // FAB drag (only when the panel is closed — when open, the header is the handle)
  const onMouseDown = useCallback(
    (e) => {
      if (isOpen) return
      e.preventDefault()
      startDrag(e.clientX, e.clientY, false)
    },
    [isOpen, startDrag]
  )
  const onTouchStart = useCallback(
    (e) => {
      if (isOpen) return
      startDrag(e.touches[0].clientX, e.touches[0].clientY, true)
    },
    [isOpen, startDrag]
  )

  // Panel header drag handle (passed into AIChat). Mouse + touch via the one core.
  const onHeaderDrag = useCallback(
    (e) => {
      const t = e.touches?.[0]
      if (t) startDrag(t.clientX, t.clientY, true)
      else {
        e.preventDefault()
        startDrag(e.clientX, e.clientY, false)
      }
    },
    [startDrag]
  )

  const handleClick = useCallback(() => {
    // Don't toggle if this was a drag
    if (hasMoved.current) return
    setIsOpen((o) => !o)
  }, [])

  // Escape closes the panel — same convention as every other overlay in the app
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (location.pathname === '/chat') return null
  if (!user) return null

  // Panel: open above or below FAB, left or right, whichever fits
  const panelRight = pos.x + BUTTON_SIZE
  const panelLeft = panelRight - PANEL_W
  const panelBottom = pos.y + BUTTON_SIZE
  const panelTop = pos.y - PANEL_H - 8

  // Horizontal: prefer aligning right edge of panel to right edge of FAB
  const panelX = clamp(panelLeft, EDGE_PAD, window.innerWidth - PANEL_W - EDGE_PAD)

  // Vertical: prefer opening upward, fall back to downward
  const openUpward = panelTop >= EDGE_PAD
  const panelY = openUpward
    ? panelTop
    : clamp(panelBottom + 8, EDGE_PAD, window.innerHeight - PANEL_H - EDGE_PAD)

  return (
    <>
      {/* ── Open panel ── */}
      {isOpen && (
        <div
          className="fixed z-[60] glass-panel rounded-2xl overflow-hidden flex flex-col"
          style={{
            left: Math.max(EDGE_PAD, panelX),
            top: panelY,
            width: Math.min(PANEL_W, window.innerWidth - EDGE_PAD * 2),
            height: Math.min(PANEL_H, window.innerHeight - 80),
          }}
        >
          {/* No separate drag strip — the AIChat header IS the drag handle (onDragStart). */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AIChat
              isFullPage={false}
              onClose={() => setIsOpen(false)}
              onDragStart={onHeaderDrag}
            />
          </div>
        </div>
      )}

      {/* ── FAB button — shown ONLY when the panel is closed ── */}
      {!isOpen && (
      <div
        ref={fabRef}
        className="fixed z-[60]"
        style={{ left: pos.x, top: pos.y, width: BUTTON_SIZE, height: BUTTON_SIZE }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={handleClick}
      >
        <button
          className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing select-none glass-fab hover:scale-105"
          tabIndex={0}
          aria-label="Open Tradeo AI chat"
        >
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1" />
            <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e" />
            <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5" />
            <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5" />
            <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444" />
            <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5" />
            <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5" />
            <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e" />
            <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5" />
            <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      )}
    </>
  )
}

export default FloatingChat
