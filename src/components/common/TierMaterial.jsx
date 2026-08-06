// =============================================================================
// TierMaterial.jsx — shared per-tier visual material (Basic/Pro/Premium)
// =============================================================================
// Owner-approved design language (2026-08-06 prototype session on Home; see
// pm/plans/2026-08-06-tier-visual-identity-rollout.md for the rollout plan).
// Basic = no material, unchanged app default everywhere. Pro = deep-sapphire-
// to-bright-blue gradient. Premium = bronze-to-champagne gold gradient + a
// slow shimmer sweep. Hex values are deliberate, not Tailwind's stock
// blue-500/amber-500 — reuse verbatim, don't re-derive.
// =============================================================================

// TIER_ACCENT — consumed by TierAccentOverlay below. `null`/missing key (i.e.
// Basic) renders nothing.
export const TIER_ACCENT = {
  pro: {
    ring: 'shadow-[0_0_0_1px_rgba(35,84,201,0.35),0_10px_26px_-14px_rgba(35,84,201,0.55)] dark:shadow-[0_0_0_1px_rgba(91,157,255,0.4),0_10px_26px_-14px_rgba(35,84,201,0.7)]',
    bar: 'from-[#14275c] to-[#5b9dff]',
  },
  premium: {
    ring: 'shadow-[0_0_0_1px_rgba(217,154,31,0.4),0_12px_30px_-14px_rgba(217,154,31,0.6)] dark:shadow-[0_0_0_1px_rgba(243,192,74,0.4),0_12px_30px_-14px_rgba(217,154,31,0.75)]',
    bar: 'from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
  },
}

// Shared opacity choreography — always visible on touch (no hover gesture
// exists there); hidden until the card's `group` root is hovered on real
// pointers, so it doesn't compete with the page all the time on desktop.
const HOVER_REVEAL =
  'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300'

// TIER_RING — avatar-scaled ring + soft glow (distinct from TIER_ACCENT.ring,
// which carries a large card-elevation shadow that would overwhelm a small
// circle). Always visible, not hover-gated — this is an identity marker
// (navbar avatar), not a content card competing for attention.
export const TIER_RING = {
  pro: 'shadow-[0_0_0_2px_#2354c9,0_0_10px_2px_rgba(35,84,201,0.45)] dark:shadow-[0_0_0_2px_#5b9dff,0_0_10px_2px_rgba(91,157,255,0.5)]',
  premium:
    'shadow-[0_0_0_2px_#d99a1f,0_0_10px_2px_rgba(217,154,31,0.45)] dark:shadow-[0_0_0_2px_#f3c04a,0_0_10px_2px_rgba(243,192,74,0.5)]',
}

// ── TierAccentOverlay — glow ring + top gradient bar for a dashboard card ──
// Caller's card root must have `group relative` classes (and `rounded-2xl`
// to match the overlay's own corner radius). Renders as a separate overlay,
// not the card's own border/shadow, so the hover reveal is a clean opacity
// fade instead of a border/shadow swap.
export function TierAccentOverlay({ accent }) {
  if (!accent) return null
  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl ${accent.ring} ${HOVER_REVEAL}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-4 right-4 top-0 h-0.5 rounded-full bg-gradient-to-r ${accent.bar} ${HOVER_REVEAL}`}
      />
    </>
  )
}

// ── TierName — name-as-chip treatment (owner-picked "variant A" from a live
// badge-placement review: the name itself is the chip, with a small corner
// tag, rather than a separate pill after the name). Basic renders plain
// text, unchanged. ────────────────────────────────────────────────────────
export function TierName({ tier, name }) {
  if (tier !== 'pro' && tier !== 'premium') return name
  const isPremium = tier === 'premium'
  return (
    // Outer wrapper: positioning context ONLY, no overflow clipping — the
    // corner tag pokes outside the chip's box and was getting clipped when
    // this and the shimmer-clip lived on the same element (real bug, caught
    // live: tag rendered invisible). Inner span owns the gradient + clips
    // the shimmer; the tag is a sibling of it, not a child.
    <span className="relative inline-flex isolate">
      <span
        className={`relative inline-flex items-center overflow-hidden px-2.5 py-0.5 rounded-lg font-bold ${
          isPremium
            ? 'text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_-3px_rgba(217,150,20,0.5)]'
            : 'text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_10px_-3px_rgba(37,99,235,0.5)]'
        }`}
      >
        {name}
        {isPremium && (
          <span
            aria-hidden="true"
            className="absolute -inset-y-0.5 -inset-x-2 z-[1] bg-gradient-to-r from-transparent via-white/70 to-transparent -translate-x-[140%] animate-tier-shimmer motion-reduce:hidden"
          />
        )}
      </span>
      <span
        className={`absolute -top-2 -right-2 z-[2] px-1.5 py-0.5 rounded-full text-[8px] font-extrabold leading-none bg-white dark:bg-gray-900 border ${
          isPremium
            ? 'text-[#854f0b] dark:text-[#f3c04a] border-[#d99a1f]'
            : 'text-[#2354c9] dark:text-[#5b9dff] border-[#2354c9] dark:border-[#5b9dff]'
        }`}
      >
        {isPremium ? 'PREMIUM' : 'PRO'}
      </span>
    </span>
  )
}
