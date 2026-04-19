import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getResearchPost,
  addResearchComment,
  deleteResearchComment,
  deleteResearchPost,
  verifyResearchPost,
  pinResearchPost
} from '../api'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

const ADMIN_USER_ID = 1

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ person, size = 'w-8 h-8' }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {person?.avatar_url && !imgError ? (
        <img
          src={person.avatar_url}
          alt={person.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-white text-[10px] font-bold">
          {person?.name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}

function ResearchViewPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [actionErr, setActionErr] = useState(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentErr, setCommentErr] = useState(null)
  const [editorReady, setEditorReady] = useState(false)

  const editor = useCreateBlockNote()
  const isAdmin = user?.id === ADMIN_USER_ID

  const fetchPost = useCallback(async () => {
    try {
      setFetchError(null)
      const res = await getResearchPost(id)
      setPost(res.data)
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPost() }, [fetchPost])

  useEffect(() => {
    if (post?.content && editor && !editorReady) {
      try {
        editor.replaceBlocks(editor.document, post.content)
        setEditorReady(true)
      } catch (err) {
        console.error('Editor error:', err)
      }
    }
  }, [post, editor, editorReady])

  // Redirect to login if unauthenticated — must be in useEffect, not during render
  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  const handleComment = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    setCommentErr(null)
    try {
      await addResearchComment({ post_id: id, content: comment })
      setComment('')
      await fetchPost()
    } catch (err) {
      setCommentErr(err.response?.data?.error || 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteResearchComment(commentId)
      await fetchPost()
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete comment')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this research post?')) return
    try {
      await deleteResearchPost(id)
      navigate('/research')
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete post')
    }
  }

  const handleVerify = async () => {
    try { await verifyResearchPost(id); await fetchPost() } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to verify post')
    }
  }

  const handlePin = async () => {
    try { await pinResearchPost(id); await fetchPost() } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to pin post')
    }
  }

  if (!user) return null

  if (loading) return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 animate-pulse">
        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-4" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3 mb-8" />
        <div className="space-y-2.5">
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${100 - i*7}%` }} />)}
        </div>
      </div>
    </div>
  )

  if (fetchError) return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-3xl mx-auto text-center pt-20">
      <p className="text-[12px] text-red-400 mb-3">{fetchError}</p>
      <button onClick={() => { setFetchError(null); setLoading(true); fetchPost() }} className="text-[11px] text-blue-500 hover:underline mr-3">
        Retry
      </button>
      <button onClick={() => navigate('/research')} className="text-[11px] text-gray-400 hover:underline">
        ← Back to Research Hub
      </button>
    </div>
  )

  if (!post) return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-3xl mx-auto text-center pt-20">
      <p className="text-[12px] text-gray-400 mb-3">Post not found</p>
      <button onClick={() => navigate('/research')} className="text-[11px] text-blue-500 hover:underline">
        ← Back to Research Hub
      </button>
    </div>
  )

  return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-3xl mx-auto space-y-4">

      {actionErr && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-red-500">{actionErr}</p>
          <button onClick={() => setActionErr(null)} className="text-red-400 hover:text-red-600 text-xs ml-3">×</button>
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => navigate('/research')}
        className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Research Hub
      </button>

      {/* Article card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

        {/* Top accent bar */}
        {post.is_pinned && <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400" />}
        {post.is_verified && !post.is_pinned && <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400" />}

        <div className="p-6">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-4">
            {post.is_pinned && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Distinguished
              </span>
            )}
            {post.is_verified && !post.is_pinned && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Verified
              </span>
            )}
            {post.is_admin_post && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Admin
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug mb-5">
            {post.title}
          </h1>

          {/* Author + actions row */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <Avatar person={post.author} size="w-8 h-8" />
              <div>
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{post.author?.name || 'Unknown'}</p>
                <p className="text-[10px] text-gray-400">
                  {formatDateTime(post.created_at)}
                  {post.updated_at !== post.created_at && ' · edited'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && !post.is_verified && (
                <button onClick={handleVerify} className="text-[10px] px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-medium transition-colors">
                  Verify
                </button>
              )}
              {isAdmin && !post.is_pinned && (
                <button onClick={handlePin} className="text-[10px] px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 font-medium transition-colors">
                  Pin
                </button>
              )}
              {(isAdmin || post.user_id === user?.id) && (
                <>
                  <button
                    onClick={() => navigate(`/research/edit/${post.id}`)}
                    className="text-[10px] px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button onClick={handleDelete} className="text-[10px] px-2.5 py-1.5 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {post.post_type === 'pdf' && post.pdf_url ? (
          <div className="px-3 sm:px-6 pb-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">{post.pdf_name || 'Research PDF'}</p>
                  <p className="text-[10px] text-gray-400">PDF Document</p>
                </div>
              </div>
              <a
                href={post.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Open PDF
              </a>
            </div>
          </div>
        ) : (
          <div className="px-2 pb-4">
            <BlockNoteView editor={editor} editable={false} theme={isDark ? 'dark' : 'light'} />
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Comments {post.comments?.length > 0 && `· ${post.comments.length}`}
        </p>

        {/* Add comment */}
        <form onSubmit={handleComment} className="mb-5">
          {commentErr && (
            <p className="text-[10px] text-red-400 mb-2">{commentErr}</p>
          )}
          <div className="flex gap-2.5">
            <Avatar person={user} size="w-7 h-7" />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                {submitting ? '...' : 'Post'}
              </button>
            </div>
          </div>
        </form>

        {/* Comment list */}
        {!post.comments?.length ? (
          <p className="text-[11px] text-gray-400 text-center py-6">No comments yet — be the first</p>
        ) : (
          <div className="space-y-4">
            {post.comments.map(c => (
              <div key={c.id} className="flex gap-2.5 group">
                <Avatar person={c.author} size="w-7 h-7" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{c.author?.name || 'Unknown'}</span>
                    <span className="text-[9px] text-gray-400">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{c.content}</p>
                </div>
                {(isAdmin || c.user_id === user?.id) && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-[9px] text-red-400 hover:text-red-500 transition-all self-start mt-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ResearchViewPage
