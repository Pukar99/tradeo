// === insight/StockSearch.jsx — toolbar stock search → per-stock seasonality view ===
// Compact trigger button lives in the DataLab toolbar slot; the results panel is
// portaled to portal-root (Rule 43/44) because the toolbar strip clips overflow.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getMarketSymbols } from '../../../utils/globalCache'

const PANEL_W = 288

export default function StockSearch({ activeSymbol, onSelect, onClear }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState(null) // null = not loaded yet
  const [loadErr, setLoadErr] = useState(null)
  const [cursor, setCursor] = useState(0)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Lazy-load the symbol list on first open — globalCache shares one fetch/hour
  // across all components, so this costs nothing if another page already loaded it.
  useEffect(() => {
    if (!open || stocks !== null) return
    getMarketSymbols()
      .then((r) => {
        setStocks(r.data?.stocks || [])
        setLoadErr(null)
      })
      .catch(() => setLoadErr('Failed to load symbols'))
  }, [open, stocks])

  // Focus the input as soon as the panel opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Close on click outside or Escape (panel is portaled — check both refs)
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const list = stocks || []
    const q = query.trim().toLowerCase()
    if (!q) return list.slice(0, 25)
    // Symbol prefix matches first (what traders type), then symbol/company contains
    const starts = list.filter((s) => s.symbol.toLowerCase().startsWith(q))
    const contains = list.filter(
      (s) =>
        !s.symbol.toLowerCase().startsWith(q) &&
        (s.symbol.toLowerCase().includes(q) || (s.company_name || '').toLowerCase().includes(q))
    )
    return [...starts, ...contains].slice(0, 30)
  }, [stocks, query])

  // Keep cursor valid as the list shrinks
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Scroll the cursor row into view
  useEffect(() => {
    if (listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const pick = useCallback(
    (s) => {
      setOpen(false)
      onSelect(s.symbol, s.company_name || null)
    },
    [onSelect]
  )

  function onInputKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    }
    if (e.key === 'Enter' && filtered[cursor]) {
      e.preventDefault()
      pick(filtered[cursor])
    }
  }

  // Anchor the panel under the trigger, clamped to the viewport's right edge
  const rect = open ? btnRef.current?.getBoundingClientRect() : null
  const left = rect ? Math.min(rect.left, window.innerWidth - PANEL_W - 8) : 0
  const top = rect ? rect.bottom + 6 : 0

  return (
    <>
      {/* Trigger — shows the active stock as a clearable chip */}
      <div ref={btnRef} className="flex items-center shrink-0">
        {activeSymbol ? (
          <span className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30">
            <button
              onClick={() => setOpen((o) => !o)}
              title="Change stock"
              className="text-[10px] font-black text-blue-600 dark:text-blue-400"
            >
              {activeSymbol}
            </button>
            <button
              onClick={onClear}
              title="Back to index view"
              aria-label="Clear stock"
              className="w-4 h-4 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[11px] leading-none"
            >
              ×
            </button>
          </span>
        ) : (
          <button
            onClick={() => setOpen((o) => !o)}
            title="Search a stock — its monthly seasonality replaces the index heatmap"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-2.5 h-2.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            Stock
          </button>
        )}
      </div>

      {/* Results panel — portaled so the toolbar strip can't clip it */}
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
            style={{ left, top, width: PANEL_W, maxHeight: 320 }}
          >
            <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100 dark:border-gray-800">
              <svg
                className="w-3 h-3 text-gray-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setCursor(0)
                }}
                onKeyDown={onInputKey}
                placeholder="Symbol or company…"
                className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-gray-300 hover:text-gray-500 text-[13px] leading-none"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
              {stocks === null && !loadErr && (
                <div className="flex items-center justify-center py-5">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {loadErr && <div className="px-3 py-3 text-[11px] text-red-400">{loadErr}</div>}
              {stocks !== null && !loadErr && filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-gray-400">
                  No stocks match "{query}"
                </div>
              )}
              <ul ref={listRef}>
                {filtered.map((s, i) => (
                  <li key={s.symbol}>
                    <button
                      onClick={() => pick(s)}
                      onMouseEnter={() => setCursor(i)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-3 py-1.5 transition-colors ${
                        i === cursor ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-gray-800 dark:text-gray-100 leading-tight">
                          {s.symbol}
                        </div>
                        {s.company_name && (
                          <div className="text-[10px] text-gray-400 truncate leading-tight">
                            {s.company_name}
                          </div>
                        )}
                      </div>
                      {s.symbol === activeSymbol && (
                        <span className="shrink-0 text-[9px] font-black px-1 py-px rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                          ACTIVE
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 px-2.5 py-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                ↑↓ navigate · Enter select · Esc close
              </span>
            </div>
          </div>,
          document.getElementById('portal-root') || document.body
        )}
    </>
  )
}
