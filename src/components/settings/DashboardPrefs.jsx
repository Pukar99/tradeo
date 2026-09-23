// === DashboardPrefs.jsx — Home stats window control ===
// Renders inside the "dashboard" SettingsSection (SettingsPage.jsx). Moved from ProfilePage's
// DashboardPrefsCard (t30 HOME-9c interim home) — SAME storage key ('hp.statsMonths') the
// HomePage stats read, SAME options/behavior, just re-homed + brought up to this page's a11y
// bar (jsx-a11y ERROR scope). SettingsSection already supplies the CARD surface, so this file
// renders content only — no card-in-card.
import { useLocalStorage } from '../../hooks/useLocalStorage'

// Tab-pill tokens — copied verbatim from AppearanceSection (design.md §1 wrapper/chip/active
// strings), 44px touch target per row.
const PILL_WRAP = 'inline-flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5'
const PILL_BASE =
  'min-h-[44px] px-4 flex items-center justify-center rounded-md text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
const PILL_ACTIVE = 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
const PILL_INACTIVE =
  'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'

const ROW_LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'

export default function DashboardPrefs() {
  const [statMonthsRaw, setStatMonths] = useLocalStorage('hp.statsMonths', 2)
  const statMonths = Math.min(24, Math.max(1, parseInt(statMonthsRaw) || 2))

  return (
    <div className="space-y-4">
      <div role="group" aria-labelledby="dashboard-window-label">
        <p id="dashboard-window-label" className={`${ROW_LABEL} mb-1.5`}>
          Home stats window
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={PILL_WRAP}>
            {[1, 3, 6].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setStatMonths(m)}
                aria-pressed={statMonths === m}
                className={`${PILL_BASE} ${statMonths === m ? PILL_ACTIVE : PILL_INACTIVE}`}
              >
                {m}M
              </button>
            ))}
          </div>
          <label
            htmlFor="dashboard-window-custom"
            className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5"
          >
            <input
              id="dashboard-window-custom"
              type="number"
              min="1"
              max="24"
              value={statMonths}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                if (v >= 1 && v <= 24) setStatMonths(v)
              }}
              title="Custom window (months)"
              aria-label="Custom window (months)"
              className="min-h-[44px] w-16 px-2 rounded-md text-xs font-semibold text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            />
            months
          </label>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-2">
          Sets the period for the Realized P/L and Win Rate cards on your home dashboard.
        </p>
      </div>
    </div>
  )
}
