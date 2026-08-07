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

// getDisplayTier — the tier used for VISUAL purposes only. Admins always
// display as Premium (owner decision) regardless of their actual
// users.tier value — deliberately NOT written to the DB (tier is a billing
// concept, admin is a role concept; conflating them would corrupt the
// column for any future tier-based logic). Every consumer below should read
// tier through this helper, not `user?.tier` directly, so admin-override
// stays consistent everywhere instead of being re-implemented per call site.
export function getDisplayTier(user) {
  if (user?.is_admin) return 'premium'
  return user?.tier
}

// TIER_ACCENT — bar (top gradient stripe) per tier, consumed by
// TierAccentOverlay below. `null`/missing key (i.e. Basic) renders nothing.
// The glow ring used to live here too, but it's a shadow, not a fill color —
// see tierRingClass below for why it's now a separate, card-root-only thing.
export const TIER_ACCENT = {
  pro: {
    bar: 'from-[#14275c] to-[#5b9dff]',
  },
  premium: {
    bar: 'from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad]',
  },
}

// Shared opacity choreography — hidden by default on every device. Revealed
// by :hover on pointer devices (mouse), and by :active (finger actually
// down) on touch — NOT constantly-on on touch (owner caught live: "the
// shadow and line is always seen [on mobile], not when we touch it" — the
// original design treated touch as having no interaction gesture at all and
// left it permanently visible, which reads as noise once actually seen live).
const HOVER_REVEAL =
  'opacity-0 group-active:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300'

// tierRingClass(tier) — soft ambient glow ONLY, no hairline border (owner
// call: drop the crisp 1px edge, keep pure blur — a defined edge still reads
// as a border even as a shadow, not just as the literal `border` utility).
// MUST be spread into the CARD's OWN className, never a child overlay: an
// element's own box-shadow is never clipped by that same element's own
// overflow-hidden/overflow-y-auto — only a CHILD's shadow extending past the
// parent gets clipped. The ring previously rendered as a child
// `absolute inset-0` div inside TierAccentOverlay and got cut off on every
// card that scrolls or clips content (real bug: "shadow is barely visible").
// Written as complete literal per-tier strings, not assembled from stored
// hex fragments at call time — Tailwind's build only generates CSS for
// class names that appear as complete literal substrings in source; a class
// built by concatenating a hover:/dark: prefix onto a fragment at runtime
// never appears literally anywhere, so Tailwind silently never compiles it
// and the rule does nothing, in any theme.
// active: fires while an element is actually being pressed — mouse-down on
// desktop, finger-down on touch — so touch gets a real "only while touching
// it" gesture instead of the old constant-on state. hover:hover stays
// gated behind the media query so it never fires from a mobile tap (some
// mobile browsers apply a brief "sticky hover" after tap otherwise).
const TIER_RING_CLASS = {
  pro: 'active:shadow-[0_10px_26px_-14px_rgba(35,84,201,0.55)] dark:active:shadow-[0_10px_26px_-14px_rgba(35,84,201,0.7)] [@media(hover:hover)]:hover:shadow-[0_10px_26px_-14px_rgba(35,84,201,0.55)] dark:[@media(hover:hover)]:hover:shadow-[0_10px_26px_-14px_rgba(35,84,201,0.7)] transition-shadow duration-300',
  premium:
    'active:shadow-[0_12px_30px_-14px_rgba(217,154,31,0.6)] dark:active:shadow-[0_12px_30px_-14px_rgba(217,154,31,0.75)] [@media(hover:hover)]:hover:shadow-[0_12px_30px_-14px_rgba(217,154,31,0.6)] dark:[@media(hover:hover)]:hover:shadow-[0_12px_30px_-14px_rgba(217,154,31,0.75)] transition-shadow duration-300',
}

export function tierRingClass(tier) {
  return TIER_RING_CLASS[tier] || ''
}

// TIER_RING — avatar-scaled ring + soft glow (distinct from TIER_ACCENT.ring,
// which carries a large card-elevation shadow that would overwhelm a small
// circle). Always visible, not hover-gated — this is an identity marker
// (navbar avatar), not a content card competing for attention.
export const TIER_RING = {
  pro: 'shadow-[0_0_0_2px_#2354c9,0_0_10px_2px_rgba(35,84,201,0.45)] dark:shadow-[0_0_0_2px_#5b9dff,0_0_10px_2px_rgba(91,157,255,0.5)]',
  premium:
    'shadow-[0_0_0_2px_#d99a1f,0_0_10px_2px_rgba(217,154,31,0.45)] dark:shadow-[0_0_0_2px_#f3c04a,0_0_10px_2px_rgba(243,192,74,0.5)]',
}

// TIER_TEXT — plain solid tier-colored text (no gradient, no chip, no glow).
// For small text-only accents: the active nav-tab label and the Home
// greeting's name. Basic/undefined has no entry — callers fall back to
// whatever their own default color is.
export const TIER_TEXT = {
  pro: 'text-[#2354c9] dark:text-[#5b9dff]',
  premium: 'text-[#a06a0e] dark:text-[#f3c04a]',
}

// ── TierAccentOverlay — top gradient bar for a dashboard card. The glow ring
// is a separate thing now (tierRingClass, spread into the card's own
// className) — this only renders the decorative bar, which is a plain
// background-color fill, not a shadow, so it's safe as a clipped child.
// Caller's card root must have `group relative` classes (and `rounded-2xl`
// to match this bar's own corner radius, or pass a matching `radius`
// override for cards using a different corner size).
//
// Spans the FULL top edge (not inset with `left-4 right-4`) and uses the
// card's own top corner radius (`rounded-t-2xl`), not `rounded-full` — a
// `rounded-full` pill only reads as curved when it's thick relative to its
// height, but at h-0.5/h-[3px] it's just a flat straight segment floating
// under the card's actual (curved) top edge, not tracing it (owner-caught:
// "the shadow is not visible... not curved"). Positioned at -1px on
// top/left/right, not 0 — a `position: absolute` child's containing block is
// the parent's PADDING box, inside the parent's own border, so at `top-0`
// the bar would sit just inside any border and not fully cover the card's
// outer edge.
export function TierAccentOverlay({ accent, radius = 'rounded-t-2xl' }) {
  if (!accent) return null
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -left-px -right-px -top-px h-[3px] ${radius} bg-gradient-to-r ${accent.bar} ${HOVER_REVEAL}`}
    />
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
