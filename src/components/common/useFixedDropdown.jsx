// === useFixedDropdown.jsx — shared hook: positions a portalled dropdown below its trigger ===
// align='left' anchors to left edge of trigger, 'right' anchors to right edge.
// Clamps the dropdown inside the viewport so it never spills off a narrow screen.
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

export function useFixedDropdown(align = 'left') {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef = useRef(null)
  const dropRef = useRef(null) // ref on the portalled div — excluded from outside-click

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!open) return
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open, updateRect])

  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target)
      const inDrop = dropRef.current?.contains(e.target)
      if (!inTrigger && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  // Position the dropdown and CLAMP it inside the viewport so it never spills off
  // the right (or left) edge on a narrow screen. Without this, a left-aligned
  // ~240px dropdown opened near the right side of a phone runs off-screen.
  const VP_MARGIN = 8 // keep this gap from the viewport edges
  const EST_WIDTH = 240 // dropdown design width (matches the portal content)
  const dropStyle = rect
    ? (() => {
        const vw = window.innerWidth
        const maxWidth = vw - VP_MARGIN * 2 // never wider than the viewport
        const width = Math.min(EST_WIDTH, maxWidth)
        const preferredLeft = align === 'right' ? rect.right - width : rect.left
        const left = Math.max(VP_MARGIN, Math.min(preferredLeft, vw - width - VP_MARGIN))
        return {
          position: 'fixed',
          top: rect.bottom + 4,
          left,
          maxWidth,
          zIndex: 9999,
        }
      })()
    : {}

  const portal = useCallback(
    (content) => {
      if (!open || !rect) return null
      return createPortal(
        <div ref={dropRef} style={dropStyle}>
          {content}
        </div>,
        document.body
      )
    },
    [open, rect, dropStyle]
  ) // eslint-disable-line react-hooks/exhaustive-deps -- dropStyle is rebuilt from rect each render; listing it alone (not its parts) keeps the portal stable per open/rect change

  return { triggerRef, open, setOpen, portal, updateRect }
}
