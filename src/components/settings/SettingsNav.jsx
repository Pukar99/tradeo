// === SettingsNav.jsx — desktop sticky rail + mobile/tablet sticky pill strip (SET-11, Wave 4) ===
// Shared section-nav data (id/label/icon) + two renderers (rail, pill strip) + one
// IntersectionObserver hook that tracks which section is currently under the sticky
// offset — used by both renderers so only ONE `useState` exists for "active id" (ADR-04:
// UI state, not a data store). No scroll listener (perf) and no naive offsetTop math
// (breaks under variable content height) — IntersectionObserver only, per Wave-4 QA mandate.
//
// Sticky offset measurement (real navbar, non-autoHide path SettingsPage always uses):
// Navbar.jsx renders `<nav className="glass-bar ... py-0 ... sticky top-0">` with NO
// explicit height — content drives it. Tallest child is the logo link (`py-3` = 12px top+
// bottom + 34px TradeoLogo svg = 58px) vs the right-side controls (`w-11 h-11` = 44px,
// `min-h-[44px]` toggle) — logo wins. Plus `.glass-bar`'s 1px border-bottom (index.css:129).
// Measured height = 58 + 1 = 59px. `top-[60px]` gives a 1px buffer so the rail/strip never
// gaps or overlaps the navbar's bottom edge. z-40 is explicit and BELOW the navbar's z-50
// (Navbar.jsx:233) so the navbar always wins any stacking conflict.
import { useEffect, useRef, useState } from 'react'

// Section registry — id must match the SettingsSection `id` prop in SettingsPage.jsx.
// Order here = the rail/pill display order = IA order (R17): Account, Security, Appearance,
// Dashboard, Integrations, Danger.
export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'danger', label: 'Danger', danger: true },
]

// Navbar's real measured height (see header comment) — single source for the offset so the
// rail, the pill strip, and the observer's rootMargin all agree.
const NAVBAR_H = 60

/**
 * Tracks which section id is "active" (current scroll position) via IntersectionObserver.
 * rootMargin is tuned so the observer's virtual viewport starts right below the sticky
 * offset (navbar, or navbar+strip on mobile) and ends near the bottom — this makes exactly
 * one section "intersecting" at a time at typical scroll positions/boundaries.
 * @param {string[]} ids section ids in document order
 * @param {number} topOffset px to shrink the observer's top edge by (sticky stack height)
 */
function useActiveSection(ids, topOffset) {
  const [activeId, setActiveId] = useState(ids[0])
  const ratiosRef = useRef({})

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratiosRef.current[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0
        })
        // Pick the most-visible intersecting section; ties broken by document order (ids order).
        let best = null
        let bestRatio = 0
        for (const id of ids) {
          const ratio = ratiosRef.current[id] || 0
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        if (best) setActiveId(best)
      },
      {
        // Shrink the top by the sticky stack height so a section counts as "entered" only
        // once its heading clears the rail/strip; shrink the bottom so short trailing
        // sections (Danger) can still become active without needing to reach mid-viewport.
        rootMargin: `-${topOffset}px 0px -60% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids, topOffset])

  return activeId
}

// ── Shared link styling ──────────────────────────────────────────────────────────────
function railLinkClasses(isActive, danger) {
  if (danger) {
    return isActive
      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold'
      : 'text-red-500/80 dark:text-red-400/70 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400'
  }
  return isActive
    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold'
    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
}

// ── Desktop sticky rail (lg: and up) ─────────────────────────────────────────────────
export function SettingsRail() {
  const ids = SETTINGS_SECTIONS.map((s) => s.id)
  const activeId = useActiveSection(ids, NAVBAR_H)

  return (
    <nav
      aria-label="Settings sections"
      className="hidden lg:block sticky top-[60px] z-40 self-start h-fit"
    >
      <ul className="space-y-0.5">
        {SETTINGS_SECTIONS.map(({ id, label, danger }) => {
          const isActive = activeId === id
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${railLinkClasses(isActive, danger)}`}
              >
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ── Mobile/tablet sticky pill strip (below lg) ───────────────────────────────────────
// Layout is custom (horizontal scroll strip, not the compact center-column ViewSwitcher),
// but the chip/wrapper STYLING is the exact §1 tab-pill token, sized up to 44px per the
// established settings deviation (AppearanceSection.jsx PILL_BASE precedent).
const PILL_WRAP = 'flex items-center gap-1'
const PILL_BASE =
  'shrink-0 min-h-[44px] px-3.5 flex items-center rounded-md text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
const PILL_ACTIVE = 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
const PILL_INACTIVE =
  'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
const PILL_ACTIVE_DANGER = 'bg-white dark:bg-gray-700 shadow-sm text-red-600 dark:text-red-400'
const PILL_INACTIVE_DANGER =
  'text-red-500/80 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400'

export function SettingsPillStrip() {
  const ids = SETTINGS_SECTIONS.map((s) => s.id)
  const activeId = useActiveSection(ids, NAVBAR_H + 56)

  return (
    <nav
      aria-label="Settings sections"
      className="lg:hidden sticky top-[60px] z-40 -mx-3 sm:-mx-6 px-3 sm:px-6 py-1.5 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800"
    >
      <div className={`${PILL_WRAP} overflow-x-auto no-scrollbar`}>
        {SETTINGS_SECTIONS.map(({ id, label, danger }) => {
          const isActive = activeId === id
          const activeCls = danger ? PILL_ACTIVE_DANGER : PILL_ACTIVE
          const inactiveCls = danger ? PILL_INACTIVE_DANGER : PILL_INACTIVE
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={isActive ? 'true' : undefined}
              className={`${PILL_BASE} ${isActive ? activeCls : inactiveCls}`}
            >
              {label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
