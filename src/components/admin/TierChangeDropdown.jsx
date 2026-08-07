// === TierChangeDropdown.jsx ===
import { useState } from 'react'
import { patchUserTier } from '@api/admin'
import toast from 'react-hot-toast'

const TIERS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

// Must match utils/tierExpiry.js VALID_DURATIONS on the backend.
const DURATIONS = [
  { value: '7d', label: '7 days' },
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: 'lifetime', label: 'Lifetime' },
]

export default function TierChangeDropdown({ user, onClose, onSuccess }) {
  const [selected, setSelected] = useState(user.tier)
  // No default duration — an existing temporary tier's exact bucket (7d vs
  // 1m vs …) can't be recovered from just an expiry timestamp, and
  // defaulting to Lifetime would risk silently turning a temporary grant
  // permanent if the admin clicks Confirm without touching it. Pro/Premium
  // always requires an explicit pick.
  const [duration, setDuration] = useState(null)
  const [loading, setLoading] = useState(false)

  const needsDuration = selected !== 'basic'
  const canConfirm = needsDuration ? duration !== null : selected !== user.tier

  async function handleConfirm() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const { data } = await patchUserTier(user.id, selected, needsDuration ? duration : undefined)
      const durationLabel = needsDuration
        ? DURATIONS.find((d) => d.value === duration)?.label
        : null
      toast.success(
        durationLabel && durationLabel !== 'Lifetime'
          ? `${user.name} moved to ${selected} for ${durationLabel}`
          : `${user.name} moved to ${selected}`
      )
      onSuccess({ ...user, tier: selected, tier_expires_at: data?.tier_expires_at ?? null })
    } catch {
      toast.error('Failed to change tier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/15 border-t border-amber-100 dark:border-amber-800/30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Change tier:
          </span>
          <div className="flex items-center gap-1">
            {TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setSelected(t.value)
                  setDuration(null)
                }}
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
            disabled={loading || !canConfirm}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>

      {needsDuration && (
        <div className="flex items-center gap-2 pl-[76px]">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">For:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                  duration === d.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
