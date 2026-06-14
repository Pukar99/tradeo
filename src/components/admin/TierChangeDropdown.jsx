// === TierChangeDropdown.jsx ===
import { useState } from 'react'
import { patchUserTier } from '@api/admin'
import toast from 'react-hot-toast'

const TIERS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

export default function TierChangeDropdown({ user, onClose, onSuccess }) {
  const [selected, setSelected] = useState(user.tier)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (selected === user.tier) {
      onClose()
      return
    }
    setLoading(true)
    try {
      await patchUserTier(user.id, selected)
      toast.success(`${user.name} moved to ${selected}`)
      onSuccess({ ...user, tier: selected })
    } catch {
      toast.error('Failed to change tier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/15 border-t border-amber-100 dark:border-amber-800/30">
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Change tier:</span>
        <div className="flex items-center gap-1">
          {TIERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setSelected(t.value)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                selected === t.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || selected === user.tier}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40 transition-colors"
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
