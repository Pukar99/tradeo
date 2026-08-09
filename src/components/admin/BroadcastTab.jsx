// === BroadcastTab.jsx ===
// Visual pass 2026-08-09.
//
// Real bug fixed here, found by reading the code against the live dev
// database: the one real announcement has is_active=true but expires_at is
// over a month in the past. routes/notifications.js's bell query filters
// `expires_at.gt.now()`, so it stopped reaching anyone the moment it expired
// — but the admin toggle has shown a live green "Active" the entire time.
// Same shape of bug as the tier badge before round 1: a stored flag drifts
// from a real-time condition and nothing recomputes it for display. Fixed
// the same way — effectiveStatus() derives Live/Expired/Off from is_active
// AND expires_at together, never is_active alone.
import { useState, useEffect, useCallback } from 'react'
import {
  postAdminAnnouncement,
  patchAdminAnnouncement,
  deleteAdminAnnouncement,
} from '@api/admin'
import { getAdminAnnouncements, clearAdminAnnouncementsCache } from '../../utils/adminCache'
import AdminEmptyState from './AdminEmptyState'
import ActionPanel from './ActionPanel'
import toast from 'react-hot-toast'

const TARGETS = [
  { value: 'all', label: 'All' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

// Pro/Premium wear the real tier material — target IS a tier here, same rule
// Feature Flags' scope chips follow. all/basic stay neutral. Complete literal
// strings, not assembled fragments (Tailwind only compiles literal matches).
const TARGET_CHIP = {
  all: 'font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  basic: 'font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro: 'font-bold text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_10px_-4px_rgba(37,99,235,0.55)]',
  premium:
    'font-bold text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_-4px_rgba(217,150,20,0.55)]',
}

const TARGET_SELECTED = {
  all: 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
  basic: 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
  pro: 'text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff]',
  premium: 'text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
}

const TARGET_LABEL = { all: 'All', basic: 'Basic', pro: 'Pro', premium: 'Premium' }

function TargetChip({ target }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] leading-none flex-shrink-0 ${
        TARGET_CHIP[target] || TARGET_CHIP.all
      }`}
    >
      {TARGET_LABEL[target] || target}
    </span>
  )
}

// The row's TRUE state — see the file header. `expires_at` beats `is_active`:
// an expired announcement reads Expired even if nobody ever turned it off.
function effectiveStatus(item) {
  if (item.expires_at && new Date(item.expires_at) <= new Date()) return 'expired'
  return item.is_active ? 'live' : 'off'
}

function shortDate(iso) {
  return iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'
}

function AnnouncementRow({ item, onToggle, onDelete }) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleToggle() {
    if (toggling) return
    setToggling(true)
    try {
      await onToggle(item.id, !item.is_active)
    } finally {
      setToggling(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const status = effectiveStatus(item)
  const sent = shortDate(item.created_at)

  return (
    <div>
      <div
        className={`group/row relative flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
          status === 'off' ? 'opacity-60' : ''
        }`}
      >
        {/* Hover accent, tier-coloured for Pro/Premium targets — same
            language as Content/Flags rows. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 ${
            item.target === 'pro'
              ? 'bg-gradient-to-b from-[#14275c] to-[#5b9dff]'
              : item.target === 'premium'
                ? 'bg-gradient-to-b from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]'
                : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />

        {/* Title + body + target/status/sender */}
        <div className="flex-1 min-w-0 pt-px">
          <p className="text-[13px] font-semibold tracking-[-0.005em] text-gray-900 dark:text-white truncate">
            {item.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
            {item.body}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <TargetChip target={item.target} />
            {status === 'live' && (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-gray-500 dark:text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {status === 'expired' && (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                Expired {shortDate(item.expires_at)}
              </span>
            )}
            {status === 'off' && (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                Off
              </span>
            )}
            {item.creator_name && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                — {item.creator_name}
              </span>
            )}
          </div>
        </div>

        {/* Sent date */}
        <div className="hidden md:block w-16 flex-shrink-0 pt-px">
          <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{sent}</span>
        </div>

        {/* Active toggle — controls is_active only; effectiveStatus() still
            reports Expired even while this reads on, which is the point. */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          role="switch"
          aria-checked={item.is_active}
          aria-label={item.is_active ? `Deactivate ${item.title}` : `Activate ${item.title}`}
          className={`mt-px relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${
            item.is_active
              ? 'bg-emerald-600'
              : 'bg-gray-200 dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-700'
          }`}
        >
          <span
            className={`absolute left-0 top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
              item.is_active ? 'translate-x-4 bg-white' : 'translate-x-0.5 bg-white dark:bg-gray-400'
            }`}
          />
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirming((prev) => !prev)}
          aria-label={`Delete ${item.title}`}
          title="Delete announcement"
          className="mt-px w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-45 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
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

      {confirming && (
        <ActionPanel
          tone="red"
          title="Delete announcement"
          subject={item.title}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmDelete}
          loading={deleting}
          loadingLabel="Deleting…"
          confirmLabel="Delete"
        >
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {TARGET_LABEL[item.target] || item.target}
            {item.creator_name ? ` · sent by ${item.creator_name}` : ''}
            {status === 'expired' ? ` · expired ${shortDate(item.expires_at)}` : ''}. This cannot
            be undone.
          </p>
        </ActionPanel>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-2.5 w-72 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-14 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="w-9 h-5 mt-0.5 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse flex-shrink-0" />
      <div className="w-6 h-6 mt-0.5 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse flex-shrink-0" />
    </div>
  )
}

const BROADCAST_EMPTY_ICON = (
  <>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </>
)

// Exact markup/classes copied from Navbar.jsx's bell dropdown — a real,
// working preview of what a recipient sees, not an approximation. Always
// renders the "unread" treatment (green tint + dot) since a just-composed
// message reads as unread to everyone.
function BellPreview({ title, body }) {
  const hasTitle = title.trim().length > 0
  const hasBody = body.trim().length > 0
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">
        <svg
          className="w-2.5 h-2.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Exactly what appears in the bell
      </p>
      <div className="w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Notifications</p>
        </div>
        {hasTitle || hasBody ? (
          <div className="text-left px-4 py-3 bg-green-50 dark:bg-green-900/10">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {hasTitle ? title : 'Your title appears here'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {hasBody ? body : 'The message body shows exactly like this.'}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
            No notifications
          </div>
        )}
      </div>
    </div>
  )
}

export default function BroadcastTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('all')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)

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

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setCreating(true)
    try {
      await postAdminAnnouncement({
        title: title.trim(),
        body: body.trim(),
        target,
        expires_at: expiresAt || null,
      })
      toast.success('Announcement sent')
      setTitle('')
      setBody('')
      setTarget('all')
      setExpiresAt('')
      // Drop the cache BEFORE refetching, or fetchAnnouncements() would be
      // served the pre-create snapshot and the new item wouldn't appear.
      clearAdminAnnouncementsCache()
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
      clearAdminAnnouncementsCache()
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: isActive } : a)))
      toast.success(isActive ? 'Announcement activated' : 'Announcement deactivated')
    } catch {
      toast.error('Failed to update announcement')
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAdminAnnouncement(id)
      clearAdminAnnouncementsCache()
      setItems((prev) => prev.filter((a) => a.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const inputCls =
    'w-full px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700 focus:ring-4 focus:ring-gray-900/5 dark:focus:ring-white/5'

  return (
    <div className="flex flex-col gap-0">
      {/* Compose */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <form onSubmit={handleCreate} className="flex flex-col gap-2.5">
          <div>
            <label
              htmlFor="bc-title"
              className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5"
            >
              Title
            </label>
            <input
              id="bc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              maxLength={120}
              required
              className={`h-9 ${inputCls}`}
            />
          </div>

          <div>
            <label
              htmlFor="bc-body"
              className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5"
            >
              Message
            </label>
            <textarea
              id="bc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body"
              maxLength={500}
              required
              rows={3}
              className={`py-2.5 resize-none ${inputCls}`}
            />
          </div>

          <div className="flex items-center flex-wrap gap-4 pt-1">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Target
              </span>
              <div className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {TARGETS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTarget(t.value)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                      target === t.value
                        ? `${TARGET_SELECTED[t.value]} shadow-sm`
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="bc-expires"
                className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5"
              >
                Expires (optional)
              </label>
              <input
                id="bc-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-8 px-2.5 text-[11px] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={creating || !title.trim() || !body.trim()}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-[11.5px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
              {creating ? 'Sending…' : 'Send'}
            </button>
          </div>

          <div className="pt-2">
            <BellPreview title={title} body={body} />
          </div>
        </form>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Announcement
        </div>
        <div className="hidden md:block w-16 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Sent
        </div>
        <div className="w-9 flex-shrink-0" />
        <div className="w-6 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : items.length === 0 ? (
          <AdminEmptyState
            title="No announcements yet"
            icon={BROADCAST_EMPTY_ICON}
            hint="Compose one above to send it to the notification bell."
          />
        ) : (
          items.map((item) => (
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
