// === ContentTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAdminPosts } from '@api/admin'
import PostListRow from './PostListRow'
import AdminSearchInput from '../common/AdminSearchInput'

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="hidden md:block w-10 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="hidden lg:block w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="flex gap-1">
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
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
      const params = { page, limit: 30 }
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <AdminSearchInput
          onSearch={(q) => {
            setQuery(q)
            setPage(1)
          }}
          placeholder="Search by title…"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {total} posts
        </span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Post
        </div>
        <div className="hidden sm:block w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Status
        </div>
        <div className="hidden md:block w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Comments
        </div>
        <div className="hidden lg:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Date
        </div>
        <div className="w-16 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : posts.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No posts found
          </div>
        ) : (
          posts.map((p) => <PostListRow key={p.id} post={p} onRefresh={fetchPosts} />)
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
