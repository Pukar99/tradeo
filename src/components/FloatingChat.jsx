import { useState, useRef, useEffect, useCallback } from 'react'
import AIChat from './AIChat'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

// Clamp a position so the panel stays fully on-screen
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const PANEL_W = 340
const PANEL_H = 500
const BUTTON_SIZE = 48
const EDGE_PAD = 16

function FloatingChat() {
  const [isOpen, setIsOpen]   = useState(false)
  const { user }              = useAuth()
  const location              = useLocation()

  // Position of the FAB (bottom-right by default, stored as distance from top-left)
  const [pos, setPos] = useState(() => {
    try {
      const saved = sessionStorage.getItem('floatingChat_pos')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      x: window.innerWidth  - BUTTON_SIZE - EDGE_PAD,
      y: window.innerHeight - BUTTON_SIZE - EDGE_PAD,
    }
  })

  const dragging  = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const hasMoved  = useRef(false)
  const fabRef    = useRef(null)

  // Keep in bounds when window resizes
  useEffect(() => {
    const onResize = () => {
      setPos(p => ({
        x: clamp(p.x, EDGE_PAD, window.innerWidth  - BUTTON_SIZE - EDGE_PAD),
        y: clamp(p.y, EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onMouseDown = useCallback((e) => {
    // Only drag on the FAB itself (not inside the open panel)
    if (isOpen) return
    e.preventDefault()
    dragging.current  = true
    hasMoved.current  = false
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }

    const onMove = (e) => {
      if (!dragging.current) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true
      const nx = clamp(dragStart.current.px + dx, EDGE_PAD, window.innerWidth  - BUTTON_SIZE - EDGE_PAD)
      const ny = clamp(dragStart.current.py + dy, EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD)
      setPos({ x: nx, y: ny })
    }

    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      // Save position
      setPos(p => {
        try { sessionStorage.setItem('floatingChat_pos', JSON.stringify(p)) } catch {}
        return p
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [isOpen, pos])

  // Touch support
  const onTouchStart = useCallback((e) => {
    if (isOpen) return
    const t = e.touches[0]
    dragging.current  = true
    hasMoved.current  = false
    dragStart.current = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y }

    const onMove = (e) => {
      if (!dragging.current) return
      const t  = e.touches[0]
      const dx = t.clientX - dragStart.current.mx
      const dy = t.clientY - dragStart.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true
      const nx = clamp(dragStart.current.px + dx, EDGE_PAD, window.innerWidth  - BUTTON_SIZE - EDGE_PAD)
      const ny = clamp(dragStart.current.py + dy, EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD)
      setPos({ x: nx, y: ny })
    }

    const onEnd = () => {
      dragging.current = false
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onEnd)
      try { sessionStorage.setItem('floatingChat_pos', JSON.stringify(pos)) } catch {}
    }

    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend',  onEnd)
  }, [isOpen, pos])

  const handleClick = useCallback(() => {
    // Don't toggle if this was a drag
    if (hasMoved.current) return
    setIsOpen(o => !o)
  }, [])

  if (location.pathname === '/chat') return null
  if (!user) return null

  // Panel: open above or below FAB, left or right, whichever fits
  const panelRight  = pos.x + BUTTON_SIZE
  const panelLeft   = panelRight - PANEL_W
  const panelBottom = pos.y + BUTTON_SIZE
  const panelTop    = pos.y - PANEL_H - 8

  // Horizontal: prefer aligning right edge of panel to right edge of FAB
  const panelX = clamp(panelLeft, EDGE_PAD, window.innerWidth - PANEL_W - EDGE_PAD)

  // Vertical: prefer opening upward, fall back to downward
  const openUpward   = panelTop >= EDGE_PAD
  const panelY       = openUpward
    ? panelTop
    : clamp(panelBottom + 8, EDGE_PAD, window.innerHeight - PANEL_H - EDGE_PAD)

  return (
    <>
      {/* ── Open panel ── */}
      {isOpen && (
        <div
          className="fixed z-50 glass-panel rounded-2xl overflow-hidden flex flex-col"
          style={{
            left: Math.max(EDGE_PAD, panelX),
            top: panelY,
            width: Math.min(PANEL_W, window.innerWidth - EDGE_PAD * 2),
            height: Math.min(PANEL_H, window.innerHeight - 80),
          }}
        >
          {/* Drag handle strip at top of panel */}
          <div
            className="shrink-0 flex items-center justify-between px-3 py-1.5
              bg-white/25 dark:bg-black/25 border-b border-white/30 dark:border-white/8
              cursor-move select-none"
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX, startY = e.clientY
              const startPos = { ...pos }
              let moved = false

              const onMove = (e) => {
                moved = true
                const nx = clamp(startPos.x + (e.clientX - startX), EDGE_PAD, window.innerWidth  - BUTTON_SIZE - EDGE_PAD)
                const ny = clamp(startPos.y + (e.clientY - startY), EDGE_PAD, window.innerHeight - BUTTON_SIZE - EDGE_PAD)
                setPos({ x: nx, y: ny })
              }
              const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup',   onUp)
                if (moved) {
                  setPos(p => {
                    try { sessionStorage.setItem('floatingChat_pos', JSON.stringify(p)) } catch {}
                    return p
                  })
                }
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup',   onUp)
            }}
          >
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <div className="w-3 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                <div className="w-3 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                <div className="w-3 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <span className="text-[9px] text-gray-400 font-semibold select-none">drag to move</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded
                text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                hover:bg-gray-200 dark:hover:bg-gray-700 text-sm leading-none transition-colors"
            >
              ×
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <AIChat isFullPage={false} onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}

      {/* ── FAB button ── */}
      <div
        ref={fabRef}
        className="fixed z-50"
        style={{ left: pos.x, top: pos.y, width: BUTTON_SIZE, height: BUTTON_SIZE }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={handleClick}
      >
        <button
          className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing select-none glass-fab hover:scale-105"
          tabIndex={-1}
        >
          {(
            <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1"/>
              <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e"/>
              <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
              <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5"/>
              <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444"/>
              <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5"/>
              <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5"/>
              <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e"/>
              <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5"/>
              <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5"/>
            </svg>
          )}
        </button>
      </div>
    </>
  )
}

export default FloatingChat
