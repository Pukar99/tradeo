// === SuspendButton.jsx ===
import { useState } from 'react'
import { patchUserSuspend } from '@api/admin'
import toast from 'react-hot-toast'

export default function SuspendButton({ user, onClose, onSuccess }) {
  const isSuspended = user.is_suspended
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await patchUserSuspend(user.id, {
        suspended: !isSuspended,
        reason:    !isSuspended ? (reason.trim() || undefined) : undefined,
      })
      toast.success(isSuspended ? `${user.name} unsuspended` : `${user.name} suspended`)
      onSuccess({ ...user, is_suspended: !isSuspended })
    } catch {
      toast.error('Failed to update suspension')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 border-t ${
      isSuspended
        ? 'bg-green-50 dark:bg-green-900/15 border-green-100 dark:border-green-800/30'
        : 'bg-red-50 dark:bg-red-900/15 border-red-100 dark:border-red-800/30'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`text-xs font-medium whitespace-nowrap ${
          isSuspended
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-700 dark:text-red-400'
        }`}>
          {isSuspended ? `Unsuspend ${user.name}?` : `Suspend ${user.name}?`}
        </span>
        {!isSuspended && (
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 h-7 px-2 text-xs bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40 transition-colors ${
            isSuspended
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
