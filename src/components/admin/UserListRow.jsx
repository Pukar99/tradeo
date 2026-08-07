// === UserListRow.jsx ===
import { useState, useRef, useEffect } from 'react'
import TierBadge, { effectiveTier } from './TierBadge'
import StatusBadge from './StatusBadge'
import { TIER_RING, TIER_ACCENT } from '../common/TierMaterial'
import TierChangeDropdown from './TierChangeDropdown'
import SuspendButton from './SuspendButton'
import ActionPanel from './ActionPanel'
import { patchUserForceLogout } from '@api/admin'
import toast from 'react-hot-toast'

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  )
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-pink-500',
]

function avatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

// A user counts as "online" if any authenticated request landed within this
// window (see utils/presence.js on the backend — ~20s flush + ~25s admin poll).
const ONLINE_THRESHOLD_MS = 90 * 1000

function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function UserListRow({ user: initialUser, onRefresh, onSelectUser, dropUp = false }) {
  const [user, setUser] = useState(initialUser)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeAction, setActiveAction] = useState(null) // 'tier' | 'suspend' | 'force-logout'
  const [forceLoading, setForceLoading] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const menuRef = useRef(null)

  // Sync local user when parent list re-fetches
  useEffect(() => {
    setUser(initialUser)
  }, [initialUser])

  // Reset avatar error when the avatar URL changes
  useEffect(() => {
    setAvatarError(false)
  }, [user.avatar_url])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

  const isOnline = user.last_seen_at
    ? Date.now() - new Date(user.last_seen_at).getTime() < ONLINE_THRESHOLD_MS
    : false
  const presenceLabel = isOnline
    ? 'Online'
    : user.last_seen_at
      ? `Last seen ${timeAgo(user.last_seen_at)}`
      : 'No activity recorded'

  // The tier this row's user is actually on right now (expiry-aware — same
  // rule as the badge, imported rather than re-derived). Drives the avatar
  // ring and the hover accent bar. Note this is the TARGET user's real tier,
  // deliberately not getDisplayTier() — that helper exists to make an admin
  // *view themselves* as Premium in their own identity chrome, which would be
  // wrong here: this table reports other people's billing state.
  const rowTier = effectiveTier(user.tier, user.tier_expires_at)
  const ringClass = TIER_RING[rowTier] || ''
  const accentBar = TIER_ACCENT[rowTier]?.bar

  function selectAction(action) {
    setMenuOpen(false)
    setActiveAction((prev) => (prev === action ? null : action))
  }

  function closeAction() {
    setActiveAction(null)
  }

  function handleSuccess(updated) {
    setUser(updated)
    setActiveAction(null)
    onRefresh?.()
  }

  async function handleForceLogout() {
    if (forceLoading) return
    setForceLoading(true)
    try {
      await patchUserForceLogout(user.id)
      toast.success(`${user.name} logged out`)
      setActiveAction(null)
    } catch {
      toast.error('Failed to force logout')
    } finally {
      setForceLoading(false)
    }
  }

  return (
    <div>
      {/* Main row */}
      <div className="group/row relative flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Hover accent along the left edge — tier-coloured for Pro/Premium,
            neutral otherwise. Same hover-reveal language as the dashboard
            cards' TierAccentOverlay, rotated to the vertical edge. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 ${
            accentBar
              ? `bg-gradient-to-b ${accentBar}`
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />

        {/* Avatar — photo when available, initials fallback otherwise */}
        <div className="relative flex-shrink-0" title={presenceLabel}>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden ${avatarColor(user.id)} ${ringClass}`}
          >
            {user.avatar_url && !avatarError ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="text-white text-xs font-bold">{getInitials(user.name)}</span>
            )}
          </div>
          {/* Presence dot — online gets a slow halo ping so "who's here" is
              readable without parsing text. The ping is a sibling behind the
              solid dot, not a ring on it, so the dot itself stays crisp. */}
          <span className="absolute -bottom-0.5 -right-0.5 flex">
            {isOnline && (
              <span className="absolute inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-ring motion-reduce:hidden" />
            )}
            <span
              className={`relative w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                isOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          </span>
        </div>

        {/* Name + email — name click opens per-user analytics (Analytics tab) */}
        <div className="flex-1 min-w-0">
          {onSelectUser ? (
            <button
              onClick={() => onSelectUser(user.id)}
              title="View analytics"
              className="block text-[13px] font-semibold tracking-[-0.005em] text-gray-900 dark:text-white truncate hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors text-left w-full"
            >
              {user.name}
            </button>
          ) : (
            <p className="text-[13px] font-semibold tracking-[-0.005em] text-gray-900 dark:text-white truncate">
              {user.name}
            </p>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
        </div>

        {/* Tier */}
        <div className="hidden sm:block w-24 flex-shrink-0">
          <TierBadge tier={user.tier} expiresAt={user.tier_expires_at} />
        </div>

        {/* Status */}
        <div className="hidden md:block w-24 flex-shrink-0">
          <StatusBadge suspended={user.is_suspended} />
        </div>

        {/* Joined */}
        <div className="hidden lg:block w-32 flex-shrink-0">
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{joined}</span>
        </div>

        {/* ⋮ actions menu — dimmed until the row is hovered, but never below
            full opacity on touch (no hover there) or when focused via keyboard. */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-50 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            aria-label="User actions"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className={`absolute right-0 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50 ${
                dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              <button
                onClick={() => selectAction('tier')}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Change Tier
              </button>
              <button
                onClick={() => selectAction('suspend')}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {user.is_suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              <button
                onClick={() => selectAction('force-logout')}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Force Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline action panels — one at a time */}
      {activeAction === 'tier' && (
        <TierChangeDropdown user={user} onClose={closeAction} onSuccess={handleSuccess} />
      )}
      {activeAction === 'suspend' && (
        <SuspendButton user={user} onClose={closeAction} onSuccess={handleSuccess} />
      )}
      {activeAction === 'force-logout' && (
        <ActionPanel
          tone="amber"
          title="Force logout"
          subject={user.name}
          onCancel={closeAction}
          onConfirm={handleForceLogout}
          loading={forceLoading}
          loadingLabel="Logging out…"
          confirmLabel="Log them out"
        >
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Their current session ends immediately. They can sign back in straight away.
          </p>
        </ActionPanel>
      )}
    </div>
  )
}
