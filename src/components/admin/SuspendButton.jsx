// === SuspendButton.jsx ===
import { useState } from 'react'
import { patchUserSuspend } from '@api/admin'
import { clearAdminUsersCache } from '../../utils/adminCache'
import toast from 'react-hot-toast'
import ActionPanel, { PanelLabel } from './ActionPanel'

export default function SuspendButton({ user, onClose, onSuccess }) {
  const isSuspended = user.is_suspended
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await patchUserSuspend(user.id, {
        suspended: !isSuspended,
        reason: !isSuspended ? reason.trim() || undefined : undefined,
      })
      clearAdminUsersCache()
      toast.success(isSuspended ? `${user.name} unsuspended` : `${user.name} suspended`)
      onSuccess({ ...user, is_suspended: !isSuspended })
    } catch {
      toast.error('Failed to update suspension')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ActionPanel
      tone={isSuspended ? 'green' : 'red'}
      title={isSuspended ? 'Unsuspend account' : 'Suspend account'}
      subject={user.name}
      onCancel={onClose}
      onConfirm={handleConfirm}
      loading={loading}
      confirmLabel={isSuspended ? 'Unsuspend' : 'Suspend'}
    >
      {isSuspended ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          They get access back immediately and can sign in as normal.
        </p>
      ) : (
        <div>
          <PanelLabel>Reason (optional)</PanelLabel>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Recorded in the audit log"
            className="w-full max-w-sm h-8 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700 focus:ring-4 focus:ring-red-500/10"
          />
        </div>
      )}
    </ActionPanel>
  )
}
