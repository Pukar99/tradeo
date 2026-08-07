// === TierBadge.jsx ===
function timeUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// expiresAt: users.tier_expires_at. The badge shows the EFFECTIVE tier —
// if expiresAt has already passed but the backend hasn't swept it yet
// (lazy check / cron sweep run at most once a day), this still displays
// Basic rather than a stale paid badge.
export default function TierBadge({ tier, expiresAt }) {
  const isExpired = expiresAt && new Date(expiresAt) <= new Date()
  const effectiveTier = isExpired ? 'basic' : tier

  const styles = {
    basic: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }

  const title = isExpired
    ? 'Tier expired — reverting to Basic'
    : expiresAt
      ? `Expires in ${timeUntil(expiresAt)}`
      : effectiveTier && effectiveTier !== 'basic'
        ? 'Lifetime'
        : undefined

  return (
    <span
      title={title}
      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${styles[effectiveTier] || styles.basic}`}
    >
      {effectiveTier ? effectiveTier.charAt(0).toUpperCase() + effectiveTier.slice(1) : 'Basic'}
    </span>
  )
}
