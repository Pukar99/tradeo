import { useAuth } from '../../context/AuthContext'
import { TIER_ACCENT, getDisplayTier, TierAccentOverlay, tierRingClass } from './TierMaterial'

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    positive:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    negative:
      'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    neutral:
      'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

// ── Card shell (SMC layout redesign) ────────────────────────────────────────
// PanelShell/Section stay as-is below (still used by Price Action, unchanged
// until its own redesign pass). CardStack/Card are the new SMC-only shell:
// each section becomes its own bordered card instead of one continuous
// divide-y scroll list, matching the Admin panel's HealthTile language
// (colored left edge + tinted icon badge + bold header) — owner-approved
// mockup, 2026-08-11.
// `tiered` — the left panel is the top-level styled surface, so it owns its
// own group/ring/overlay (tiered=true, default). The right panel has a tab
// switcher ABOVE this scroll area, so ITS group/ring/overlay has to live on
// the outer wrapper that contains both the tabs and this stack (otherwise
// the hover accent bar renders below the tabs instead of at the panel's own
// top edge) — pass tiered={false} there; the outer wrapper supplies it instead.
export function CardStack({ children, tiered = true }) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const base =
    'flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900 p-2.5 space-y-2.5 animate-fade-up'
  if (!tiered) return <div className={base}>{children}</div>
  return (
    <div className={`group relative ${base} ${accent ? tierRingClass(displayTier) : ''}`}>
      <TierAccentOverlay accent={accent} radius="" />
      {children}
    </div>
  )
}

export const CARD_STRIPE = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-300 dark:bg-gray-600',
}
export const CARD_ICON_TONE = {
  positive: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  negative: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export function Card({ tone = 'neutral', icon, title, aside, index, children }) {
  return (
    <div
      className="hp-card group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-3.5 pr-3 space-y-2 animate-fade-up transition-colors"
      style={index != null ? { animationDelay: `${index * 40}ms` } : undefined}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${CARD_STRIPE[tone] || CARD_STRIPE.neutral}`}
      />
      <div className="flex items-center gap-2">
        <span
          className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center ${CARD_ICON_TONE[tone] || CARD_ICON_TONE.neutral}`}
        >
          {icon}
        </span>
        <p className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{title}</p>
        {aside && (
          <span className="ml-auto text-[9px] font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {aside}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
