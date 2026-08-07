// === UsersTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAdminUsers } from '@api/admin'
import UserListRow from './UserListRow'
import AdminSearchInput from '../common/AdminSearchInput'

const TIER_FILTERS = ['all', 'basic', 'pro', 'premium']

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-2.5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="hidden md:block w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="hidden lg:block w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  )
}

export default function UsersTab({ onSelectUser }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('all')
  const [query, setQuery] = useState('') // debounced search

  // silent=true skips the loading skeleton — used for background presence polls
  // so the list doesn't flash every 25s.
  const fetchUsers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const params = { page, limit: 20 }
        if (query) params.search = query
        if (tier !== 'all') params.tier = tier
        const { data } = await getAdminUsers(params)
        setUsers(data.users || [])
        setTotal(data.total || 0)
        setPages(data.pages || 1)
      } catch {
        if (!silent) setUsers([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [page, query, tier]
  )

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Poll for updated presence (last_seen_at) while the tab is open — keeps the
  // online dot live-ish without a websocket. Doesn't disturb open row menus;
  // UserListRow's own action/menu state is separate from the `user` prop.
  useEffect(() => {
    const id = setInterval(() => fetchUsers(true), 25 * 1000)
    return () => clearInterval(id)
  }, [fetchUsers])

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar row: search + tier filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <AdminSearchInput
          onSearch={(q) => {
            setQuery(q)
            setPage(1)
          }}
          placeholder="Search name or email…"
        />
        <div className="flex items-center gap-1">
          {TIER_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setTier(f)
                setPage(1)
              }}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                tier === f
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {total} users
        </span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          User
        </div>
        <div className="hidden sm:block w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Tier
        </div>
        <div className="hidden md:block w-24 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Status
        </div>
        <div className="hidden lg:block w-32 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Joined
        </div>
        <div className="w-7 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : users.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No users found
          </div>
        ) : (
          users.map((u, i) => (
            <UserListRow
              key={u.id}
              user={u}
              onRefresh={fetchUsers}
              onSelectUser={onSelectUser}
              dropUp={users.length > 3 && i >= users.length - 2}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
            disabled={page === pages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
