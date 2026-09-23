// === ContentTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAdminPosts } from '../../utils/adminCache'
import PostListRow from './PostListRow'
import AdminSearchInput from '../common/AdminSearchInput'
import AdminPagination from './AdminPagination'
import AdminEmptyState from './AdminEmptyState'

const PAGE_SIZE = 30

// Mirrors the real row's height and column rhythm (py-3.5, same responsive
// widths) so the list doesn't jump when data lands.
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-52 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-2.5 w-28 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-24 flex-shrink-0">
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden md:block w-16 flex-shrink-0">
        <div className="h-3 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden lg:block w-28 flex-shrink-0">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

export default function ContentTab() {
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (query) params.search = query
      const { data } = await getAdminPosts(params)
      setPosts(data.posts || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <AdminSearchInput
          onSearch={(q) => {
            setQuery(q)
            setPage(1)
          }}
          placeholder="Search by title…"
        />
        <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap">
          <b className="text-xs font-bold text-gray-900 dark:text-white">{total}</b> posts
        </span>
      </div>

      {/* Table header — hairline rule, not a filled band. "Replies" and
          "Published" are more precise than "Comments" and "Date" about what
          the number and the date actually are. */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Post
        </div>
        <div className="hidden sm:block w-24 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Status
        </div>
        <div className="hidden md:block w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Replies
        </div>
        <div className="hidden lg:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Published
        </div>
        <div className="w-[62px] flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : posts.length === 0 ? (
          <AdminEmptyState
            title="No posts found"
            hint={
              query
                ? 'Nothing matches that title. Try a different search.'
                : 'Nobody has published research yet.'
            }
            icon={
              <>
                <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 3v5h5" />
                <path d="M9 13h6" />
                <path d="M9 17h3" />
              </>
            }
          />
        ) : (
          posts.map((p) => <PostListRow key={p.id} post={p} onRefresh={fetchPosts} />)
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
