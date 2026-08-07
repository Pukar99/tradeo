// === UsersTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAdminUsers } from '@api/admin'
import UserListRow from './UserListRow'
import AdminSearchInput from '../common/AdminSearchInput'
import AdminPagination from './AdminPagination'
import AdminEmptyState from './AdminEmptyState'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'

const PAGE_SIZE = 20

// Each filter carries the swatch shown when it's the active one — the tier's
// own colour, using the same hexes as TierBadge / TierMaterial. The active
// filter used to be a flat bg-green-500 pill, which was both the last
// always-green spot in this tab and green for a control that picks a *tier*.
const TIER_FILTERS = [
  { value: 'all', label: 'All', swatch: 'bg-emerald-500' },
  { value: 'basic', label: 'Basic', swatch: 'bg-gray-400 dark:bg-gray-500' },
  { value: 'pro', label: 'Pro', swatch: 'bg-gradient-to-br from-[#14275c] to-[#5b9dff]' },
  {
    value: 'premium',
    label: 'Premium',
    swatch: 'bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
  },
]

// Mirrors the real row's height and column rhythm so the list doesn't jump
// when data lands (py-3.5, 36px avatar, same responsive column widths).
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-2.5 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-24 flex-shrink-0">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="hidden md:block w-24 flex-shrink-0">
        <div className="h-3 w-14 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden lg:block w-32 flex-shrink-0">
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="w-7 flex-shrink-0" />
    </div>
  )
}

const USERS_EMPTY_ICON = (
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 11h-6" />
  </>
)

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
        const params = { page, limit: PAGE_SIZE }
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

  const selectTier = useCallback((value) => {
    setTier(value)
    setPage(1)
  }, [])

  // Sliding pill for the tier filter — the same shared hook every other
  // segmented control in the app uses (Screen timeframes, Logs/DataLab/
  // Explore/RiskLab/IPO tab bars), so it also gets press-and-drag switching
  // for free.
  const {
    containerRef: filterRef,
    indicatorStyle: filterIndicatorStyle,
    onPointerDown: onFilterPointerDown,
  } = useSlidingIndicator(tier, selectTier)

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar row: search + tier filter */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <AdminSearchInput
          onSearch={(q) => {
            setQuery(q)
            setPage(1)
          }}
          placeholder="Search name or email…"
        />
        <div
          ref={filterRef}
          onPointerDown={onFilterPointerDown}
          className="relative flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0"
        >
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 rounded-md bg-white dark:bg-gray-700 shadow-sm transition-[transform,width,height] duration-300 ease-luxury pointer-events-none"
            style={filterIndicatorStyle}
          />
          {TIER_FILTERS.map((f) => (
            <button
              key={f.value}
              data-indicator-active={tier === f.value || undefined}
              data-indicator-key={f.value}
              onClick={() => selectTier(f.value)}
              className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-md whitespace-nowrap transition-colors ${
                tier === f.value
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  tier === f.value ? f.swatch : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap">
          <b className="text-xs font-bold text-gray-900 dark:text-white">{total}</b> users
        </span>
      </div>

      {/* Table header — a hairline rule, not a filled band; the band used to
          read heavier than the data underneath it. */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 flex-shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          User
        </div>
        <div className="hidden sm:block w-24 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
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
          <AdminEmptyState
            title="No users found"
            icon={USERS_EMPTY_ICON}
            hint={
              query || tier !== 'all'
                ? 'Nothing matches this search and filter. Try a different name, email, or tier.'
                : 'Nobody has signed up yet.'
            }
          />
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

      <AdminPagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  )
}
