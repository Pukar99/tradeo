// === SymbolSearch.jsx — shared chart-symbol search: filter, keyboard nav, portal dropdown ===
// Used across Screen (General/MultiChart/SMC/PriceAction), DataLab (Insight/Performance),
// Backtest, and Replay. NOT used by Watchlist's "add symbol" picker (different contract —
// see src/components/screen/SymbolSearch.jsx, which is a separate, untouched file).
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useFixedDropdown } from './useFixedDropdown'
import { getMarketSymbols } from '../../utils/globalCache'

export default function SymbolSearch({
  symbols,
  fetchSymbols = getMarketSymbols,
  stocksOnly = false,
  value = '',
  onSelect,
  activeValue = null,
  lazyLoad = false,
  defaultValue = null,
  globalTypeToSearch = false,
  placeholder,
  onLoadError, // optional: (message: string) => void — fires when fetchSymbols() rejects, so
  // page-level callers (e.g. a form with its own error banner) can surface the failure
  // outside the dropdown, in addition to the built-in inline `loadErr` shown on open.
  className = '', // optional: extra classes appended to the outer wrapper — lets callers
  // opt into full-width layouts (e.g. a form field) without touching the default
  // toolbar-pill sizing used by chart headers.
  inputClassName = 'w-[56px]', // optional: overrides just the input's width class; every
  // other input class (font size, uppercase, color, etc.) stays fixed so callers can't
  // accidentally break the compact toolbar look — only width is meant to be swapped.
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(-1)
  const [fetched, setFetched] = useState(symbols ?? null) // null = not loaded yet
  const [loadErr, setLoadErr] = useState(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const mouseDownInList = useRef(false)
  const didDefaultSelect = useRef(false)
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('left')

  // Self-fetch when no `symbols` prop is provided. Respects `lazyLoad`: waits for
  // first open instead of fetching on mount.
  useEffect(() => {
    if (symbols) {
      setFetched(symbols)
      return
    }
    if (lazyLoad && !open) return
    if (fetched !== null) return
    fetchSymbols()
      .then((r) => {
        const data = r?.data ?? r // supports both axios-shaped and plain-object fetchers
        setFetched({ stocks: data?.stocks ?? [], indexes: data?.indexes ?? [] })
        setLoadErr(null)
      })
      .catch(() => {
        setLoadErr('Failed to load symbols')
        onLoadError?.('Failed to load symbols')
      })
  }, [symbols, fetchSymbols, lazyLoad, open, fetched, onLoadError])

  const allItems = useMemo(() => {
    const src = fetched ?? { stocks: [], indexes: [] }
    const indexes = stocksOnly
      ? []
      : (src.indexes ?? []).map((i) => ({
          label: i.name,
          sub: 'Index',
          indexId: i.index_id,
          companyName: null,
        }))
    const stocks = (src.stocks ?? []).map((s) => ({
      label: s.symbol,
      sub: 'Stock',
      indexId: null,
      companyName: s.company_name || null,
    }))
    return [...indexes, ...stocks]
  }, [fetched, stocksOnly])

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
  ) // eslint-disable-line react-hooks/exhaustive-deps -- q derives from query, so `query` itself is intentionally omitted; deps cover every real input

  const handleSelect = useCallback(
    (item) => {
      onSelect?.(item.label, item.indexId ?? null, item.companyName ?? null)
      setQuery('')
      setOpen(false)
      setCursor(-1)
    },
    [onSelect, setOpen]
  )

  // Auto-select `defaultValue` once the list has loaded, if the caller hasn't
  // already got a value and we haven't already done this (mirrors Backtest's
  // NABIL default-select).
  useEffect(() => {
    if (didDefaultSelect.current || value || !defaultValue || !allItems.length) return
    const match = allItems.find((i) => i.label === defaultValue)
    if (match) {
      didDefaultSelect.current = true
      handleSelect(match)
    }
  }, [allItems, value, defaultValue, handleSelect])

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
      const target = cursor >= 0 ? filtered[cursor] : filtered[0]
      if (target) handleSelect(target)
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

  // TradingView-style: any printable key typed anywhere (not in another input) →
  // focus this search. Opt-in via globalTypeToSearch (only ScreenPage General tab uses it).
  useEffect(() => {
    if (!globalTypeToSearch) return
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length !== 1) return
      const inp = inputRef.current
      if (!inp) return
      e.preventDefault()
      inp.value = ''
      inp.focus()
      setQuery(e.key.toUpperCase())
      setOpen(true)
      updateRect()
      setCursor(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [globalTypeToSearch, setOpen, updateRect])

  return (
    <div
      className={`shrink-0 ${className}`}
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
          placeholder={value || placeholder || ''}
          autoComplete="off"
          spellCheck={false}
          className={`bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none uppercase ${inputClassName}`}
        />
      </div>

      {portal(
        <div
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 240, maxHeight: 280, overflowY: 'auto' }}
        >
          {loadErr ? (
            <div className="px-3 py-3 text-[10px] text-gray-400">{loadErr}</div>
          ) : filtered.length > 0 ? (
            <ul ref={listRef}>
              {filtered.map((item, i) => {
                const isActive = i === cursor || (cursor === -1 && i === 0 && query.length > 0)
                const isBadged = activeValue && item.label === activeValue
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
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isBadged && (
                        <span className="text-[9px] font-black px-1 py-px rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                          ACTIVE
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          item.sub === 'Index'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}
                      >
                        {item.sub}
                      </span>
                    </div>
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
