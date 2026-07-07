// === helpers — extracted verbatim from BreakdownPage.jsx (S2b Task 1, zero behavior change) ===

// Sector display names arrive as 'Banking Sub-Index' / 'Finance Index' — strip the suffix
export const stripIndexName = (name = '') => name.replace(' Sub-Index', '').replace(' Index', '')

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function pctTextCls(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 0) return 'text-emerald-500'
  if (pct > -12) return 'text-amber-500'
  if (pct > -25) return 'text-red-500'
  return 'text-red-700 dark:text-red-400'
}
// Continuous heatmap color — interpolates HSL between red (-25%) and emerald (+25%)
// with neutral mid-tone at 0%. No discrete buckets → no visible color cliffs at
// values like 4.9% vs 5.1%.
//   hue:   0 (red) → 152 (emerald)
//   light: tinted background (light mode 92% → 80%; dark mode 18% → 30%)
export function heatColor(pct, dark) {
  if (pct == null) return dark ? '#1f2937' : '#f9fafb'
  // Clamp magnitude at ±25% so extreme values don't all look identical
  const t = Math.max(-1, Math.min(1, pct / 25))
  // t in [-1, +1] maps linearly to hue in [0, 152] (red→amber→emerald)
  const hue = ((t + 1) / 2) * 152
  // Magnitude controls saturation/lightness — flat at 0%, more intense at ±25%
  const mag = Math.abs(t)
  if (dark) {
    // Dark mode: from gray-tinted (18% L) up to deep colored bg (28% L)
    const l = 18 + mag * 10
    const s = 30 + mag * 40
    return `hsl(${hue}, ${s}%, ${l}%)`
  }
  // Light mode: from off-white (95% L) down to colored tint (82% L)
  const l = 95 - mag * 13
  const s = 30 + mag * 50
  return `hsl(${hue}, ${s}%, ${l}%)`
}
// Continuous HSL: red(0)→amber(50)→emerald(100). x in [-1,1].
export function gradColor(x) {
  if (x == null) return '#9ca3af'
  const t = Math.max(0, Math.min(1, (x + 1) / 2)) // -1→0, 0→0.5, 1→1
  const hue = 0 + t * 152 // 0 red → 152 emerald
  return `hsl(${hue}, 70%, 48%)`
}
export function phaseCls(phase) {
  const m = {
    Crash:
      'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    'Bear Market':
      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    Correction:
      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    'Major Bull':
      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    'Bull Run':
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800',
    Rally:
      'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  }
  return m[phase] || 'bg-gray-100 dark:bg-gray-800 text-gray-500'
}
