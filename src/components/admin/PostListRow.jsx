// === PostListRow.jsx ===
// Visual pass 2026-08-08 (owner picked "match the Research page"):
//
// 1. is_verified and is_admin_post were already in the /admin/posts response
//    and rendered nowhere — the row showed only is_pinned. All three now show.
// 2. The words and colours are the Research page's own (ResearchPage.jsx /
//    ResearchViewPage.jsx): Distinguished = emerald, Verified = blue,
//    Admin = purple. Previously this table called is_pinned "Pinned" in BLUE,
//    which is the colour Research uses for Verified — so the admin panel was
//    using the product's vocabulary to mean something else.
//
// One deliberate divergence from ResearchPage: it renders Verified only when
// a post ISN'T pinned (Distinguished visually supersedes it there). This is a
// moderation table, so it reports every flag that is actually true — hiding
// real state from the person moderating would be the wrong trade.
import { useState } from 'react'
import { deleteAdminPost, patchPostPin } from '@api/admin'
import toast from 'react-hot-toast'
import ActionPanel from './ActionPanel'

// Copied verbatim from ResearchPage.jsx's badge row so the two stay identical.
// leading-none added: these sit next to 11px author text and would otherwise
// inherit the row's line-height and render taller than their own content.
const CHIP = 'text-[10px] font-semibold leading-none px-2 py-1 rounded-full tracking-wide uppercase'
const CHIP_TONE = {
  distinguished: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  verified: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  admin: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
}

export default function PostListRow({ post: initialPost, onRefresh }) {
  const [post, setPost] = useState(initialPost)
  const [activeAction, setActiveAction] = useState(null) // 'delete' | null
  const [pinLoading, setPinLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  // Hover accent keyed to the post's own state — the same emerald/blue split
  // the Research card already uses for its coloured top bar.
  const accent = post.is_pinned
    ? 'bg-gradient-to-b from-emerald-400 to-teal-400'
    : post.is_verified
      ? 'bg-gradient-to-b from-blue-400 to-indigo-400'
      : 'bg-gray-300 dark:bg-gray-600'

  const isPublished = post.status === 'published'

  async function handlePin() {
    if (pinLoading) return
    setPinLoading(true)
    try {
      const { data } = await patchPostPin(post.id)
      const pinned = data?.is_pinned ?? !post.is_pinned
      setPost((p) => ({ ...p, is_pinned: pinned }))
      toast.success(pinned ? 'Post distinguished' : 'Post no longer distinguished')
    } catch {
      toast.error('Failed to update post')
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
      <div className="group/row relative flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 ${accent}`}
        />

        {/* Title + author + flags */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.005em] text-gray-900 dark:text-white truncate mb-0.5">
            {post.title}
          </p>
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {post.author_name}
            </p>
            {post.is_pinned && (
              <span className={`flex-shrink-0 ${CHIP} ${CHIP_TONE.distinguished}`}>
                Distinguished
              </span>
            )}
            {post.is_verified && (
              <span className={`flex-shrink-0 ${CHIP} ${CHIP_TONE.verified}`}>Verified</span>
            )}
            {post.is_admin_post && (
              <span className={`flex-shrink-0 ${CHIP} ${CHIP_TONE.admin}`}>Admin</span>
            )}
          </div>
        </div>

        {/* Status — Published is the norm so it recedes; Draft is the exception.
            Also capitalised: `status` was rendering raw from the database. */}
        <div className="hidden sm:block w-24 flex-shrink-0">
          {isPublished ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium leading-none text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold leading-none rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Draft
            </span>
          )}
        </div>

        {/* Reply count */}
        <div className="hidden md:flex items-center gap-1.5 w-16 flex-shrink-0">
          <svg
            className="w-3 h-3 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
            {post.comment_count}
          </span>
        </div>

        {/* Date */}
        <div className="hidden lg:block w-28 flex-shrink-0">
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{date}</span>
        </div>

        {/* Actions — dimmed until row hover on pointer devices, always full on
            touch (no hover there) and on keyboard focus. */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handlePin}
            disabled={pinLoading}
            title={post.is_pinned ? 'Remove Distinguished' : 'Distinguish'}
            aria-label={post.is_pinned ? 'Remove Distinguished' : 'Distinguish'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-40 ${
              post.is_pinned
                ? 'text-emerald-500 opacity-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-50 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill={post.is_pinned ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          <button
            onClick={() => setActiveAction((prev) => (prev === 'delete' ? null : 'delete'))}
            title="Delete post"
            aria-label="Delete post"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-50 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {activeAction === 'delete' && (
        <ActionPanel
          tone="red"
          title="Delete post"
          subject={post.title}
          onCancel={() => setActiveAction(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
          loadingLabel="Deleting…"
          confirmLabel="Delete post"
        >
          {/* The old band truncated the title and said nothing else. Author and
              reply count make it clear what's about to be destroyed. */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            By {post.author_name} · {post.comment_count}{' '}
            {post.comment_count === 1 ? 'reply' : 'replies'}. This cannot be undone.
          </p>
        </ActionPanel>
      )}
    </div>
  )
}
