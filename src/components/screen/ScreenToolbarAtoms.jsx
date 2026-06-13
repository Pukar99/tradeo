// === ScreenToolbarAtoms.jsx — shared compact toolbar primitives for all Screen tabs ===
// Used by: SMCChartPage, PriceActionPage, MultiChartPage (and any future tab).
// General tab uses StockChart's own ChartSymbolSearch + ChartHUDControls instead.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useScreen } from '../../context/ScreenContext'
import { useNavbarState } from '../../App'

// ── useFixedDropdown ──────────────────────────────────────────────────────────
// Shared hook — positions a portalled dropdown below its trigger.
// align='left' anchors to left edge of trigger, 'right' anchors to right edge.
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

  const dropStyle = rect
    ? {
        position: 'fixed',
        top: rect.bottom + 4,
        ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
        zIndex: 9999,
      }
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
  ) // eslint-disable-line react-hooks/exhaustive-deps

  return { triggerRef, open, setOpen, portal, updateRect }
}

// ── ToolbarDivider ─────────────────────────────────────────────────────────────
export function ToolbarDivider() {
  return <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
}

// ── ToolbarSymbolSearch ────────────────────────────────────────────────────────
// Compact inline search — stocks only when stocksOnly=true, both when false.
// Receives pre-fetched `symbols` from parent to avoid per-instance fetches.
// onSelect override: (symbol, indexId, companyName) — called in addition to
// ScreenContext selectSymbol. Pass null if not needed.
export function ToolbarSymbolSearch({ symbols, stocksOnly = false, onSelect }) {
  const { selectedSymbol, selectSymbol } = useScreen() || {}
  const { showNavbar } = useNavbarState()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const mouseDownInList = useRef(false)
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('left')

  useEffect(() => {
    if (!open) return
    const fn = () => showNavbar()
    document.addEventListener('mousemove', fn)
    return () => document.removeEventListener('mousemove', fn)
  }, [open, showNavbar])

  const allItems = useMemo(() => {
    const indexes = stocksOnly
      ? []
      : (symbols?.indexes ?? []).map((i) => ({
          label: i.name,
          sub: 'Index',
          indexId: i.index_id,
          companyName: null,
        }))
    const stocks = (symbols?.stocks ?? []).map((s) => ({
      label: s.symbol,
      sub: 'Stock',
      indexId: null,
      companyName: s.company_name || null,
    }))
    return [...indexes, ...stocks]
  }, [symbols, stocksOnly])

  const q = query.toLowerCase()
  const filtered = useMemo(
    () =>
      query.length < 1
        ? allItems.slice(0, 20)
        : allItems
            .filter(
              (i) =>
                i.label.toLowerCase().startsWith(q) ||
                i.label.toLowerCase().includes(q) ||
                (i.companyName && i.companyName.toLowerCase().includes(q))
            )
            .sort(
              (a, b) =>
                (a.label.toLowerCase().startsWith(q) ? 0 : 1) -
                (b.label.toLowerCase().startsWith(q) ? 0 : 1)
            )
            .slice(0, 30),
    [allItems, q, query.length]
  ) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (item) => {
      selectSymbol?.(item.label, item.indexId ?? null, null, item.companyName ?? null)
      onSelect?.(item.label, item.indexId ?? null, item.companyName ?? null)
      setQuery('')
      setOpen(false)
      setCursor(-1)
    },
    [selectSymbol, onSelect, setOpen]
  )

  function handleKey(e) {
    if (!open) {
      setOpen(true)
      updateRect()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    }
    if (e.key === 'Enter') {
      const t = cursor >= 0 ? filtered[cursor] : filtered[0]
      if (t) handleSelect(t)
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setCursor(-1)
    }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current)
      listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div
      className="shrink-0"
      ref={triggerRef}
      onClick={() => {
        setOpen(true)
        updateRect()
        setTimeout(() => inputRef.current?.focus(), 30)
      }}
    >
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        <svg
          className="w-2.5 h-2.5 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase())
            setOpen(true)
            updateRect()
            setCursor(-1)
          }}
          onFocus={() => {
            setOpen(true)
            updateRect()
          }}
          onBlur={() => {
            if (!mouseDownInList.current) setOpen(false)
          }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          autoComplete="off"
          spellCheck={false}
          className="bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none w-[56px] uppercase"
        />
      </div>

      {portal(
        <div
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 240, maxHeight: 280, overflowY: 'auto' }}
        >
          {filtered.length > 0 ? (
            <ul ref={listRef}>
              {filtered.map((item, i) => {
                const isActive = i === cursor || (cursor === -1 && i === 0 && query.length > 0)
                return (
                  <li
                    key={item.label}
                    onMouseDown={() => {
                      mouseDownInList.current = true
                      handleSelect(item)
                      mouseDownInList.current = false
                    }}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                        {item.label}
                      </span>
                      {item.companyName && (
                        <span className="text-[10px] text-gray-400 truncate leading-tight">
                          {item.companyName}
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        item.sub === 'Index'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {item.sub}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-3 py-3 text-[10px] text-gray-400">
              No results for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ToolbarTimeframes ──────────────────────────────────────────────────────────
// Compact segmented timeframe control reading from ScreenContext.
// Pass custom `frames` array to override defaults.
const DEFAULT_TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']

export function ToolbarTimeframes({ frames = DEFAULT_TIMEFRAMES, onChange }) {
  const { timeframe, setTimeframe } = useScreen() || {}

  const handleClick = useCallback(
    (tf) => {
      setTimeframe?.(tf)
      onChange?.(tf)
    },
    [setTimeframe, onChange]
  )

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
      {frames.map((tf) => (
        <button
          key={tf}
          onClick={() => handleClick(tf)}
          className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${
            timeframe === tf
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

// ── ToolbarToggleChip ──────────────────────────────────────────────────────────
// Inline toggle button with custom active colour.
export function ToolbarToggleChip({ label, active, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border whitespace-nowrap ${
        active
          ? 'text-white border-transparent'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      style={active ? { backgroundColor: activeColor } : {}}
    >
      {label}
    </button>
  )
}

// ── ToolbarConfigButton ────────────────────────────────────────────────────────
// Gear/config trigger + portalled popover. Pass children as the popover body.
// While open, blocks navbar autohide via a document-level mousemove listener —
// the portal sits over the chart area which would otherwise fire scheduleHide.
export function ToolbarConfigButton({ label = 'Config', children }) {
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('right')
  const { showNavbar } = useNavbarState()

  useEffect(() => {
    if (!open) return
    // Suppress autohide for the entire duration the popover is open.
    // showNavbar() clears the hide timer — calling it on every mousemove
    // means the 1s countdown never completes while the user is interacting.
    const fn = () => showNavbar()
    document.addEventListener('mousemove', fn)
    return () => document.removeEventListener('mousemove', fn)
  }, [open, showNavbar])

  return (
    <div ref={triggerRef}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          updateRect()
        }}
        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border whitespace-nowrap ${
          open
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {label}
      </button>
      {portal(
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 min-w-[220px] max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}

// ── ToolbarConfigTitle ─────────────────────────────────────────────────────────
export function ToolbarConfigTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  )
}

// ── ToolbarConfigSection ───────────────────────────────────────────────────────
export function ToolbarConfigSection({ label, children }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  )
}

// ── ToolbarSegment ─────────────────────────────────────────────────────────────
// Segmented button row for config options (e.g. 1%, 2%, 3%).
export function ToolbarSegment({ options, value, onChange, activeColor = 'bg-blue-600' }) {
  return (
    <div className="flex gap-1">
      {options.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
            value === v
              ? `${activeColor} text-white`
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
