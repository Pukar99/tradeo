// === TierBadge.jsx ===
export default function TierBadge({ tier }) {
  const styles = {
    basic:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pro:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[tier] || styles.basic}`}>
      {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Basic'}
    </span>
  )
}
