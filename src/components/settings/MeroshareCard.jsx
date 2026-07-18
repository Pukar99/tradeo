// === MeroshareCard.jsx — STATIC MeroShare integration card (Gate-3) ===
// Owner Gate-3 security ruling (2026-07-18): Settings must NEVER contact the MeroShare
// accounts backend. That endpoint returns decrypted credentials to the browser before React
// can filter, so client-side filtering is not a safe mitigation — only a genuinely static
// card is. This file performs no data loading of any kind and displays no account data. It
// renders a short static line plus a real react-router Link to the IPO page, where account
// management and auto-apply actually live. A dynamic status (connected/accountCount/
// autoApplyEnabled) would need a new non-sensitive summary route — a separate future task.
import { Link } from 'react-router-dom'

// Link style reused from WatchlistPanel.jsx:781-786 ("View all in Portfolio →") — the
// codebase's existing secondary-action "go to full page" link pattern — adapted to a real
// <Link> (keyboard operable) with the settings-folder focus-ring convention (AppearanceSection/
// DashboardPrefs) and a ≥44px touch target.
const MANAGE_LINK =
  'inline-flex min-h-[44px] items-center gap-1 px-4 rounded-md text-[12px] font-semibold text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'

export default function MeroshareCard() {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        Manage accounts, auto-apply, and IPO applications from the IPO page — nothing is
        configured here.
      </p>
      <Link to="/explore/ipo" className={MANAGE_LINK}>
        Manage MeroShare →
      </Link>
    </div>
  )
}
