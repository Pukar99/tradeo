// =============================================================================
// useSlidingIndicator.js — shared position/size for a sliding pill background,
// plus optional press-and-drag switching across the same row.
// =============================================================================
// Measures the DOM node marked data-indicator-active="true" inside the
// returned containerRef and reports its rect (relative to the container) as
// inline styles for an absolutely-positioned indicator div. Re-measures on
// every activeKey change and whenever the container resizes (responsive
// label swaps, window resize) via ResizeObserver.
//
// useLayoutEffect (not useEffect) so the very first measurement lands before
// the browser's first paint — the indicator never visibly jumps from a
// default position on mount, same reasoning as the toolbar-slot ref pattern
// in ScreenPage.jsx/DataLabPage.jsx.
//
// containerRef is a CALLBACK ref, not a plain useRef — some callers (e.g.
// LogsPage) render a loading skeleton first and only mount the real
// container once data arrives, on a render where activeKey hasn't changed.
// A plain ref + an effect keyed on [activeKey] would silently never
// re-measure in that case (the container went from null to a real node, but
// nothing in the effect's deps changed to say so). The callback fires
// exactly when the node attaches, tracked here via a tick counter that's
// also in the effect's deps, so attachment itself triggers a measurement.
//
// Drag (optional, pass onDragChange): press down anywhere in the row and
// drag across other options — whichever one is under the pointer fires
// onDragChange, and the existing CSS transition on the indicator (already
// wired to activeKey) animates the slide, so dragging across three tabs in
// one gesture just looks like three quick chained slides — no separate
// "follow the raw cursor" animation system needed.
//
// Mouse/pen only (pointerType !== 'touch') — touch keeps its native tap +
// horizontal-scroll behavior. Rows that overflow (Screen's tab strip scrolls
// horizontally on narrow screens) need real touch scroll, and a touch drag
// can't be both "pan the row" and "drag-select a tab" at once without extra
// gesture-disambiguation plumbing that isn't worth it for a mouse-first ask.
//
// Uses document-level pointermove/pointerup listeners rather than
// setPointerCapture — capturing the pointer on the container would also
// retarget the compatibility `click` event some browsers still synthesize,
// which risks silently breaking the plain (non-drag) click each button
// already handles via its own onClick. Document listeners are inert to that
// — same pattern already used for outside-click detection elsewhere in this
// app (DataLabPage's InfoButton, ScreenToolbarAtoms' ToolbarMenu).
// =============================================================================

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useSlidingIndicator(activeKey, onDragChange) {
  const containerNodeRef = useRef(null)
  const [style, setStyle] = useState({ opacity: 0 })
  const [attachTick, setAttachTick] = useState(0)
  const draggingRef = useRef(false)
  const lastFiredKeyRef = useRef(activeKey)

  const containerRef = useCallback((node) => {
    containerNodeRef.current = node
    setAttachTick((t) => t + 1)
  }, [])

  useLayoutEffect(() => {
    const container = containerNodeRef.current
    if (!container) return

    const measure = () => {
      const active = container.querySelector('[data-indicator-active="true"]')
      if (!active) {
        setStyle((s) => ({ ...s, opacity: 0 }))
        return
      }
      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      setStyle({
        opacity: 1,
        transform: `translate(${activeRect.left - containerRect.left}px, ${activeRect.top - containerRect.top}px)`,
        width: `${activeRect.width}px`,
        height: `${activeRect.height}px`,
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [activeKey, attachTick])

  useLayoutEffect(() => {
    lastFiredKeyRef.current = activeKey
  }, [activeKey])

  const keyAt = useCallback((x, y) => {
    const container = containerNodeRef.current
    if (!container) return null
    const el = document.elementFromPoint(x, y)
    const btn = el?.closest('[data-indicator-key]')
    if (!btn || !container.contains(btn)) return null
    return btn.getAttribute('data-indicator-key')
  }, [])

  const onPointerDown = useCallback(
    (e) => {
      if (!onDragChange) return
      if (e.pointerType === 'touch') return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      draggingRef.current = true

      const onMove = (moveEvent) => {
        if (!draggingRef.current) return
        const key = keyAt(moveEvent.clientX, moveEvent.clientY)
        if (key && key !== lastFiredKeyRef.current) {
          lastFiredKeyRef.current = key
          onDragChange(key)
        }
      }
      const onUp = () => {
        draggingRef.current = false
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    [onDragChange, keyAt]
  )

  return { containerRef, indicatorStyle: style, onPointerDown }
}
