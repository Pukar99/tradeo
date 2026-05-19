import { useState, useEffect, useRef } from 'react'
import { getMarketSymbols } from '../../utils/globalCache'
import { useScreen } from '../../context/ScreenContext'

export default function SymbolSearch() {
  const { selectedSymbol, selectSymbol } = useScreen()
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [symbols, setSymbols]   = useState({ stocks: [], indexes: [] })
  const [cursor, setCursor]     = useState(-1)
  const [loadErr, setLoadErr]   = useState(null)
  const inputRef       = useRef(null)
  const listRef        = useRef(null)
  // Tracks whether a list item is being clicked so blur doesn't close the list prematurely
  const mouseDownInList = useRef(false)

  useEffect(() => {
    getMarketSymbols()
      .then(r => { setSymbols(r.data); setLoadErr(null) })
      .catch(() => setLoadErr('Failed to load symbols'))
  }, []) // globalCache wrapper — at most 1 DB call/hour shared across all components

  const allItems = [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id, company_name: null })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock', company_name: s.company_name || null })),
  ]

  const q = query.toLowerCase()
  const filtered = query.length < 1 ? allItems.slice(0, 20) : allItems.filter(i =>
    i.label.toLowerCase().includes(q) ||
    (i.company_name && i.company_name.toLowerCase().includes(q))
  ).slice(0, 30)

  function handleSelect(item) {
    selectSymbol(item.label, item.indexId || null, null, item.company_name || null)
    setQuery('')
    setOpen(false)
    setCursor(-1)
  }

  function handleKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) handleSelect(filtered[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  // Scroll cursor into view
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const el = listRef.current.children[cursor]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor])

  return (
    <div className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          className="bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li
                key={item.label}
                onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                  i === cursor
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.label}</span>
                  {item.company_name && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{item.company_name}</span>
                  )}
                </div>
                <span className={`shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                  item.sub === 'Index'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>{item.sub}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && filtered.length === 0 && query.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-3 text-[11px] text-gray-400">
          {loadErr ? loadErr : `No results for "${query}"`}
        </div>
      )}
    </div>
  )
}
