// === BroadcastTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import {
  getAdminAnnouncements,
  postAdminAnnouncement,
  patchAdminAnnouncement,
  deleteAdminAnnouncement,
} from '@api/admin'
import toast from 'react-hot-toast'

const TARGET_COLORS = {
  all:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  basic:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const TARGETS = ['all', 'basic', 'pro', 'premium']

function AnnouncementRow({ item, onToggle, onDelete }) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleToggle() {
    if (toggling) return
    setToggling(true)
    try { await onToggle(item.id, !item.is_active) }
    finally { setToggling(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(item.id) }
    finally { setDeleting(false); setConfirming(false) }
  }

  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <div>
      <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
        !item.is_active ? 'opacity-50' : ''
      }`}>
        {/* Title + body */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{item.title}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.body}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${TARGET_COLORS[item.target] || TARGET_COLORS.all}`}>
              {item.target}
            </span>
            {item.expires_at && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                expires {new Date(item.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="hidden md:block w-16 flex-shrink-0 pt-0.5">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{date}</span>
        </div>

        {/* Active toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          aria-label={item.is_active ? 'Deactivate' : 'Activate'}
          className={`mt-0.5 relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            item.is_active ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
          } disabled:opacity-50`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            item.is_active ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirming(prev => !prev)}
          aria-label="Delete announcement"
          className="mt-0.5 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Delete confirm */}
      {confirming && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border-t border-red-100 dark:border-red-800/30">
          <span className="text-xs text-red-700 dark:text-red-400 font-medium truncate">
            Delete "{item.title}"? This cannot be undone.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-2.5 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
      <div className="w-9 h-5 mt-0.5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="w-7 h-7 mt-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>
  )
}

export default function BroadcastTab() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [target,    setTarget]    = useState('all')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating,  setCreating]  = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      const { data } = await getAdminAnnouncements()
      setItems(data.announcements || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setCreating(true)
    try {
      await postAdminAnnouncement({
        title: title.trim(),
        body:  body.trim(),
        target,
        expires_at: expiresAt || null,
      })
      toast.success('Announcement sent')
      setTitle('')
      setBody('')
      setTarget('all')
      setExpiresAt('')
      fetchAnnouncements()
    } catch {
      toast.error('Failed to create announcement')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(id, isActive) {
    try {
      await patchAdminAnnouncement(id, { is_active: isActive })
      setItems(prev => prev.map(a => a.id === id ? { ...a, is_active: isActive } : a))
      toast.success(isActive ? 'Announcement activated' : 'Announcement deactivated')
    } catch {
      toast.error('Failed to update announcement')
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAdminAnnouncement(id)
      setItems(prev => prev.filter(a => a.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Create form */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          New Announcement
        </p>
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={120}
            required
            className="h-8 px-3 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Message body"
            maxLength={500}
            required
            rows={3}
            className="px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="h-8 px-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              {TARGETS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="h-8 px-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
              title="Expires on (optional)"
            />
            <button
              type="submit"
              disabled={creating || !title.trim() || !body.trim()}
              className="ml-auto px-4 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {creating ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Announcement</div>
        <div className="hidden md:block w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">Date</div>
        <div className="w-9 flex-shrink-0" />
        <div className="w-7 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-gray-500">
            No announcements yet
          </div>
        ) : (
          items.map(item => (
            <AnnouncementRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
