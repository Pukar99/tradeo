// === SecuritySection.jsx — password change sub-form (moved from ProfilePage, Wave 3 SET-7) ===
// Renders inside the "security" SettingsSection (SettingsPage.jsx). Validation rules, error/success
// copy, and the changePassword payload shape are replicated EXACTLY from ProfilePage.jsx's
// handleChangePassword (:166-201): mismatch check -> min-length check -> same-as-current check ->
// changePassword({ currentPassword, newPassword }) -> success message -> form reset -> 2s auto-close
// of the success banner. No delete-account/danger-zone logic here (SET-8). a11y: every input has a
// real <label htmlFor>, unique ids prefixed `security-`, 44px targets, dark: pairs, focus rings —
// mirrors AccountSection.jsx's established pattern. NOTE: AccountSection also keeps an explicit
// aria-label on each nested input; that is required here too — the jsx-a11y/control-has-
// associated-label rule (error-scoped for src/components/settings/**) does not treat a <label>
// wrapping BOTH a text span AND the <input> as sufficient without it, so removing aria-label
// fails `npm run lint` (verified locally). Kept for lint-green parity with the shipped file.
import { useState } from 'react'
import { changePassword } from '../../api'

const LABEL_CLS =
  'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'
const INPUT_CLS =
  'w-full min-h-[44px] border rounded-xl px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-gray-800 dark:text-white'
const INPUT_BORDER = 'border-gray-200 dark:border-gray-700 focus:border-blue-500'

export default function SecuritySection() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    setSavingPassword(true)
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordSuccess('Password changed successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        setPasswordSuccess('')
      }, 2000)
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-4">
      {passwordError && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{passwordError}</span>
          <button
            type="button"
            onClick={() => setPasswordError('')}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}
      {passwordSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-4 py-3 rounded-xl text-sm">
          ✓ {passwordSuccess}
        </div>
      )}

      <form onSubmit={handleChangePassword} autoComplete="off">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="security-current-password" className={LABEL_CLS}>
              <span>Current Password</span>
              <input
                id="security-current-password"
                type="password"
                aria-label="Current Password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                placeholder="••••••••"
                className={`${INPUT_CLS} ${INPUT_BORDER}`}
                required
              />
            </label>
          </div>
          <div>
            <label htmlFor="security-new-password" className={LABEL_CLS}>
              <span>New Password</span>
              <input
                id="security-new-password"
                type="password"
                aria-label="New Password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                placeholder="••••••••"
                className={`${INPUT_CLS} ${INPUT_BORDER}`}
                required
              />
            </label>
          </div>
          <div>
            <label htmlFor="security-confirm-password" className={LABEL_CLS}>
              <span>Confirm New Password</span>
              <input
                id="security-confirm-password"
                type="password"
                aria-label="Confirm New Password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                placeholder="••••••••"
                className={`${INPUT_CLS} ${INPUT_BORDER}`}
                required
              />
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={savingPassword}
          className="min-h-[44px] px-6 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          {savingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}
