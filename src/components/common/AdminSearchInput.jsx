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

  return (
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder={placeholder}
      className="flex-1 h-8 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
    />
  )
}
