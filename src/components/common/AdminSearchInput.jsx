// === AdminSearchInput.jsx — shared debounced search input for admin list tabs ===
import { useState, useEffect } from 'react'

export default function AdminSearchInput({ onSearch, placeholder = 'Search…' }) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      onSearch(search)
    }, 350)
    return () => clearTimeout(t)
  }, [search, onSearch])

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
