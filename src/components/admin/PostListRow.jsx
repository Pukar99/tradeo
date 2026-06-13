// === PostListRow.jsx ===
import { useState } from 'react'
import { deleteAdminPost, patchPostPin } from '@api/admin'
import toast from 'react-hot-toast'

export default function PostListRow({ post: initialPost, onRefresh }) {
  const [post,          setPost]          = useState(initialPost)
  const [activeAction,  setActiveAction]  = useState(null) // 'delete' | null
  const [pinLoading,    setPinLoading]    = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  async function handlePin() {
    if (pinLoading) return
    setPinLoading(true)
    try {
      const { data } = await patchPostPin(post.id)
      const pinned = data?.is_pinned ?? !post.is_pinned
      setPost(p => ({ ...p, is_pinned: pinned }))
      toast.success(pinned ? 'Post pinned' : 'Post unpinned')
    } catch {
      toast.error('Failed to update pin')
    } finally {
      setPinLoading(false)
    }
  }

  async function handleDelete() {
    if (deleteLoading) return
    setDeleteLoading(true)
    try {
      await deleteAdminPost(post.id)
      toast.success('Post deleted')
      onRefresh?.()
    } catch {
      toast.error('Failed to delete post')
      setDeleteLoading(false)
      setActiveAction(null)
    }
  }

  return (
    <div>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Title + author (+ pinned badge — inline so columns stay aligned) */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{post.title}</p>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{post.author_name}</p>
            {post.is_pinned && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Pinned
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="hidden sm:block w-20 flex-shrink-0">
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
            post.status === 'published'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {post.status}
          </span>
        </div>

        {/* Comment count */}
        <div className="hidden md:flex items-center gap-1 w-16 flex-shrink-0">
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs text-gray-500 dark:text-gray-400">{post.comment_count}</span>
        </div>

        {/* Date */}
        <div className="hidden lg:block w-28 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">{date}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pin toggle */}
          <button
            onClick={handlePin}
            disabled={pinLoading}
            title={post.is_pinned ? 'Unpin' : 'Pin'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              post.is_pinned
                ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={post.is_pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={() => setActiveAction(prev => prev === 'delete' ? null : 'delete')}
            title="Delete post"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {activeAction === 'delete' && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border-t border-red-100 dark:border-red-800/30">
          <span className="text-xs text-red-700 dark:text-red-400 font-medium truncate">
            Delete "{post.title}"? This cannot be undone.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setActiveAction(null)}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
