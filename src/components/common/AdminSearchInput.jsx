// === AdminSearchInput.jsx — shared debounced search input for admin list tabs ===
import { useState, useEffect, useRef } from 'react'

export default function AdminSearchInput({ onSearch, placeholder = 'Search…' }) {
  const [search, setSearch] = useState('')
  // Latest-callback ref so the debounce timer arms only on actual typing.
  // Callers pass inline arrows (new identity every render); if onSearch were an
  // effect dependency, any parent re-render (e.g. loading flips after a page
  // change) would re-arm the timer and fire a stale onSearch('') → setPage(1),
  // silently bouncing a user off page 2+.
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const t = setTimeout(() => {
      onSearchRef.current(search)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Visual pass 2026-08-08: magnifier glyph inside the field, taller target,
  // and a soft focus ring instead of the 1px green one. The wrapper carries
  // flex-1 now (it used to sit on the input itself) so callers keep the same
  // "search grows, controls stay put" toolbar behaviour.
  return (
    <div className="relative flex-1 min-w-[120px]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-3 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700 focus:ring-4 focus:ring-gray-900/5 dark:focus:ring-white/5"
      />
    </div>
  )
}
