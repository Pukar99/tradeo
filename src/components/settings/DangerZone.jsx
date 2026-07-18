// === DangerZone.jsx — delete-account flow (moved from ProfilePage, Wave 3 SET-8) ===
// Renders inside the "danger" SettingsSection (SettingsPage.jsx, tone="danger", LAST section).
// Warning copy, password-confirm input, and handleDeleteAccount are replicated EXACTLY from
// ProfilePage.jsx's danger-zone form (:687-753) and handleDeleteAccount (:203-220): the
// empty-password guard there is a SUBMIT-TIME check (`if (!deletePassword) { setDeleteError(...);
// return }`), not a disabled-button state — ported faithfully as the same submit-time check here
// (QA A6: clicking Delete with an empty field renders the client error and fires NO network
// request, matching the original mechanism). On success: deleteAccount({ password }) -> logout()
// -> navigate('/login'), identical to ProfilePage. a11y: real <label htmlFor> + aria-label on the
// nested input (AccountSection.jsx/SecuritySection.jsx convention, required by the error-scoped
// jsx-a11y rule), id prefixed `danger-`, autoComplete="current-password", 44px targets, dark: pairs.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { deleteAccount } from '../../api'

const LABEL_CLS = 'block text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5'
const INPUT_CLS =
  'w-full min-h-[44px] border rounded-xl px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:bg-gray-800 dark:text-white border-red-200 dark:border-red-800 focus:border-red-500'

export default function DangerZone() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeleteError('')
    if (!deletePassword) {
      setDeleteError('Password is required')
      return
    }
    setDeleting(true)
    try {
      await deleteAccount({ password: deletePassword })
      logout()
      navigate('/login')
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Permanently removes all your data. This cannot be undone.
      </p>

      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-3 py-2 rounded-xl text-sm flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleDeleteAccount} className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter your password to confirm deletion of all trades, journals, research, and settings.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="danger-delete-password" className={LABEL_CLS}>
              <span>Password</span>
              <input
                id="danger-delete-password"
                type="password"
                aria-label="Password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className={INPUT_CLS}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={deleting}
            className="min-h-[44px] px-5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            {deleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </form>
    </div>
  )
}
