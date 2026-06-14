// =============================================================================
// UpgradePrompt.jsx — Shown in tab content area when a Basic-tier user hits a
// Pro-gated feature (mirrors the 403 { upgradeRequired: true } the backend
// requireTier middleware returns — backend is the authority on tier).
// =============================================================================
// Props: feature (string — display name), requiredTier ('pro' | 'premium')
// =============================================================================

import { Link } from 'react-router-dom'

const TIER_LABEL = { pro: 'Pro', premium: 'Premium' }

export default function UpgradePrompt({ feature, requiredTier = 'pro' }) {
  const tierLabel = TIER_LABEL[requiredTier] || 'Pro'

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-20 animate-fade-up">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-2xl bg-amber-400/15 animate-pulse-ring" />
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative z-10">
          <svg
            className="w-7 h-7 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>
      <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          {feature} requires {tierLabel}
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Upgrade your plan to unlock {feature} and other {tierLabel} features.
        </p>
      </div>
      <Link
        to="/profile"
        className="animate-fade-up text-[10px] font-semibold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
        style={{ animationDelay: '160ms' }}
      >
        View Plan
      </Link>
    </div>
  )
}
