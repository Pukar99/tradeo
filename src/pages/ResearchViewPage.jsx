import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

function ResearchViewPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editorReady, setEditorReady] = useState(false)

  const editor = useCreateBlockNote()
  const isAdmin = user?.id === ADMIN_USER_ID

  useEffect(() => {
    fetchPost()
  }, [id])

  useEffect(() => {
    if (post?.content && editor && !editorReady) {
      try {
        editor.replaceBlocks(editor.document, post.content)
        setEditorReady(true)
      } catch (err) {
        console.error('Editor error:', err)
      }
    }
  }, [post, editor])

  const fetchPost = async () => {
    try {
      const res = await getResearchPost(id)
      setPost(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await addResearchComment({ post_id: id, content: comment })
      setComment('')
      fetchPost()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteResearchComment(commentId)
      fetchPost()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this research post?')) return
    try {
      await deleteResearchPost(id)
      navigate('/research')
    } catch (err) {
      console.error(err)
    }
  }

  const handleVerify = async () => {
    try {
      await verifyResearchPost(id)
      fetchPost()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePin = async () => {
    try {
      await pinResearchPost(id)
      fetchPost()
    } catch (err) {
      console.error(err)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (loading) return (
    <div className="w-full px-6 py-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 animate-pulse">
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mb-8" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-4/6" />
        </div>
      </div>
    </div>
  )

  if (!post) return (
    <div className="w-full px-6 py-6 max-w-4xl mx-auto text-center">
      <p className="text-gray-400">Post not found</p>
      <button
        onClick={() => navigate('/research')}
        className="text-blue-600 hover:underline text-sm mt-2"
      >
        Back to Research Hub
      </button>
    </div>
  )

  return (
    <div className="w-full px-6 py-6 max-w-4xl mx-auto">

      <button
        onClick={() => navigate('/research')}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-6"
      >
        ← Back to Research Hub
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-4">

        {post.is_pinned && (
          <div className="bg-green-500 px-6 py-2">
            <span className="text-white text-xs font-semibold">
              📌 Distinguished Research by Admin
            </span>
          </div>
        )}
        {post.is_verified && !post.is_pinned && (
          <div className="bg-blue-500 px-6 py-2">
            <span className="text-white text-xs font-semibold">
              ✓ Verified Research
            </span>
          </div>
        )}

        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {post.title}
          </h1>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {post.author?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {post.author?.name || 'Unknown'}
                  </p>
                  {post.is_verified && (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
                      ✓ Verified
                    </span>
                  )}
                  {post.is_admin_post && (
                    <span className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                      👑 Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {formatDate(post.created_at)}
                  {post.updated_at !== post.created_at && ' · Edited'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && !post.is_verified && (
                <button
                  onClick={handleVerify}
                  className="text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium"
                >
                  ✓ Verify Post
                </button>
              )}
              {isAdmin && !post.is_pinned && (
                <button
                  onClick={handlePin}
                  className="text-xs bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium"
                >
                  📌 Pin Post
                </button>
              )}
              {(isAdmin || post.user_id === user?.id) && (
                <>
                  <button
                    onClick={() => navigate(`/research/edit/${post.id}`)}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          <BlockNoteView
            editor={editor}
            editable={false}
            theme="light"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Comments ({post.comments?.length || 0})
        </h2>

        <form onSubmit={handleComment} className="mb-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          {post.comments?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No comments yet — be the first to comment!
            </p>
          ) : (
            post.comments?.map(c => (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {c.author?.name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {c.author?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {c.content}
                  </p>
                </div>
                {(isAdmin || c.user_id === user?.id) && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity self-start mt-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ResearchViewPage