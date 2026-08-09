// === TierChangeDropdown.jsx ===
import { useState } from 'react'
import { patchUserTier } from '@api/admin'
import { clearAdminUsersCache } from '../../utils/adminCache'
import toast from 'react-hot-toast'
import ActionPanel, { PanelLabel } from './ActionPanel'

const TIERS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

// The selected tier button previews the material it's about to grant, so the
// admin sees the outcome before confirming. Same hexes as TierBadge /
// TierMaterial — written as complete literal class strings, since Tailwind
// only compiles names that appear literally in source.
const TIER_SELECTED = {
  basic: 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
  pro: 'text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff]',
  premium: 'text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
}

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
      // onSuccess triggers the parent's list refetch — drop the cache first or
      // it would be served the pre-change snapshot.
      clearAdminUsersCache()
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
    <ActionPanel
      tone="amber"
      title="Change tier"
      subject={user.name}
      onCancel={onClose}
      onConfirm={handleConfirm}
      loading={loading}
      disabled={!canConfirm}
    >
      {/* Two labelled segmented groups. The old layout aligned the duration
          row with a hard-coded pl-[76px] to sit under the tier buttons —
          labelled groups make that alignment structural instead of magic. */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div>
          <PanelLabel>Tier</PanelLabel>
          <div className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setSelected(t.value)
                  setDuration(null)
                }}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  selected === t.value
                    ? `${TIER_SELECTED[t.value]} shadow-sm`
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {needsDuration && (
          <div>
            <PanelLabel>Duration</PanelLabel>
            <div className="inline-flex flex-wrap items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                    duration === d.value
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {needsDuration && duration === null && (
        <p className="mt-2.5 text-[11px] text-gray-400 dark:text-gray-500">
          Pick how long this lasts to continue.
        </p>
      )}
    </ActionPanel>
  )
}
