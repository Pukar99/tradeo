// === UserListRow.jsx ===
import { useState, useRef, useEffect } from 'react'
import TierBadge from './TierBadge'
import StatusBadge from './StatusBadge'
import TierChangeDropdown from './TierChangeDropdown'
import SuspendButton from './SuspendButton'
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

export default function UserListRow({ user: initialUser, onRefresh, dropUp = false }) {
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
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Avatar — photo when available, initials fallback otherwise */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${avatarColor(user.id)}`}
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

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {user.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
        </div>

        {/* Tier */}
        <div className="hidden sm:block w-20 flex-shrink-0">
          <TierBadge tier={user.tier} />
        </div>

        {/* Status */}
        <div className="hidden md:block w-24 flex-shrink-0">
          <StatusBadge suspended={user.is_suspended} />
        </div>

        {/* Joined */}
        <div className="hidden lg:block w-32 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">{joined}</span>
        </div>

        {/* ⋮ actions menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/15 border-t border-amber-100 dark:border-amber-800/30">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Force logout {user.name}? Their current session ends immediately.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={closeAction}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleForceLogout}
              disabled={forceLoading}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {forceLoading ? 'Logging out…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
