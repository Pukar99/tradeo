// === TierBadge.jsx ===
// Visual pass 2026-08-08: the badge now wears the app's real tier material
// (the same sapphire / bronze-gold gradients as TierMaterial.jsx's TierName
// chip) instead of Tailwind's stock blue-100 / amber-100 pills, which were
// the last place in the app still ignoring those chosen hexes.
//
// Scope note: tier material belongs here because a row IS one user and the
// tier is that user's real data. It deliberately does NOT go on admin chrome
// (page header, tab strip, buttons) — the admin panel isn't tier-scoped, so
// gilding the frame would imply the *viewing* admin's own tier.
//
// Gradient/shadow strings are written as complete literals, not assembled
// from fragments — Tailwind only compiles class names that appear literally
// in source (see the long note in TierMaterial.jsx).

function timeUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// The tier actually in force right now. If tier_expires_at has already passed
// but the backend hasn't swept it yet (lazy check / daily cron), this reports
// basic rather than a stale paid tier. Exported so UserListRow's avatar ring
// applies the identical rule instead of re-deriving it.
export function effectiveTier(tier, expiresAt) {
  if (expiresAt && new Date(expiresAt) <= new Date()) return 'basic'
  return tier || 'basic'
}

const TIER_CHIP = {
  basic: 'font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro: 'font-bold text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_10px_-4px_rgba(37,99,235,0.55)]',
  premium:
    'font-bold text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_-4px_rgba(217,150,20,0.55)]',
}

export default function TierBadge({ tier, expiresAt }) {
  const isExpired = expiresAt && new Date(expiresAt) <= new Date()
  const current = effectiveTier(tier, expiresAt)
  const isPaid = current === 'pro' || current === 'premium'

  // Remaining time rides inside the badge for paid tiers rather than hiding
  // in a tooltip — "how long is this grant good for" is the whole point of
  // having durations, and a hover tooltip can't be scanned down a list.
  const remaining = isPaid && expiresAt ? timeUntil(expiresAt) : null

  const title = isExpired
    ? 'Tier expired — reverting to Basic'
    : expiresAt
      ? `Expires in ${timeUntil(expiresAt)}`
      : isPaid
        ? 'Lifetime'
        : undefined

  return (
    // leading-none is load-bearing: without it this small inline chip inherits
    // the surrounding row's line-height and renders ~7px taller than its own
    // content (the same sizing bug caught live on the Home greeting chip).
    // overflow-hidden clips the Premium shimmer sweep to the chip.
    <span
      title={title}
      className={`relative inline-flex items-center overflow-hidden px-2 py-1 rounded-lg text-[10px] leading-none ${
        TIER_CHIP[current] || TIER_CHIP.basic
      }`}
    >
      <span className="relative z-[2]">
        {current.charAt(0).toUpperCase() + current.slice(1)}
      </span>
      {remaining && (
        <span className="relative z-[2] ml-1 text-[9px] font-semibold opacity-75">
          · {remaining}
        </span>
      )}
      {current === 'premium' && (
        <span
          aria-hidden="true"
          className="absolute -inset-y-0.5 -inset-x-2 z-[1] bg-gradient-to-r from-transparent via-white/70 to-transparent -translate-x-[140%] animate-tier-shimmer motion-reduce:hidden"
        />
      )}
    </span>
  )
}
