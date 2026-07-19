// === SettingsPage.jsx — orchestrator only: page header + titled sections ===
// Wave 1 (SET-2) shipped the shell with placeholder bodies; Wave 2 (SET-3/4/5) filled Appearance
// theme/language, Dashboard prefs, and the static MeroShare card. Wave 3 (SET-6+, owner-ordered
// 2026-07-19) moves identity/account editing here too — Profile becomes pure display. SET-6 added
// the Account section (avatar + profile fields); SET-7 added Security (password change); SET-8
// adds Danger zone (delete account) as the LAST section, red-toned via SettingsSection's
// tone="danger" prop. This page itself still performs ZERO network activity of its own —
// AccountSection owns its cached getProfile() call, SecuritySection/DangerZone call their APIs
// only on submit.
// SET-10 (Wave 4): every section gets a 24x24 stroke-2 inline SVG glyph (DataLabPage.jsx:56-63
// convention: viewBox 0 0 24 24, fill none, stroke currentColor, strokeWidth 2, round caps/joins)
// passed via SettingsSection's new `icon` prop; the H1 gear pictograph is replaced with a
// matching SVG. Danger zone gains a stronger visual break (extra top margin + a red divider
// line) ahead of its section.
// SET-11 (Wave 4): full-width hub — container widens max-w-2xl → max-w-5xl (ProfilePage:152
// standard); IA reorder to identity-first (Account, Security, Appearance, Dashboard,
// Integrations, Danger — R17); desktop sticky left rail (SettingsRail) + mobile/tablet sticky
// pill strip (SettingsPillStrip), both from SettingsNav.jsx, with IntersectionObserver
// active-anchor tracking. The rail/strip markup is placed BEFORE the section content column in
// this JSX — a structural DOM-order guarantee for Tab order, never a CSS `order-` hack. Still
// zero network/behavior changes (R21).
import SettingsSection from '../components/settings/SettingsSection'
import { SettingsRail, SettingsPillStrip } from '../components/settings/SettingsNav'
import AppearanceSection from '../components/settings/AppearanceSection'
import DashboardPrefs from '../components/settings/DashboardPrefs'
import MeroshareCard from '../components/settings/MeroshareCard'
import AccountSection from '../components/settings/AccountSection'
import SecuritySection from '../components/settings/SecuritySection'
import DangerZone from '../components/settings/DangerZone'

// ── Section glyphs (24x24 stroke-2, DataLabPage convention) ──────────────────────
const GearIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
const AccountIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const SecurityIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const AppearanceIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
)
const DashboardIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)
const IntegrationIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)
const DangerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function SettingsPage() {
  return (
    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">
          <span aria-hidden="true" className="w-6 h-6 shrink-0">
            {GearIcon}
          </span>
          Settings
        </h1>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          App preferences and your account.
        </p>
      </div>

      {/* Mobile/tablet sticky pill strip — below the H1, above the section column (lg:hidden) */}
      <SettingsPillStrip />

      <div className="lg:grid lg:grid-cols-[176px_1fr] lg:gap-8 lg:items-start mt-4 lg:mt-0">
        {/* Rail markup literally precedes the section content in DOM order — Tab-order
            guarantee, never a CSS `order-` hack (hidden lg:block; invisible/no tab stops
            on mobile since display:none elements are unfocusable). */}
        <SettingsRail />

        <div className="space-y-4 min-w-0">
          <SettingsSection
            id="account"
            title="Account"
            caption="Your profile details and avatar."
            icon={AccountIcon}
          >
            <AccountSection />
          </SettingsSection>

          <SettingsSection id="security" title="Security" caption="Change your password." icon={SecurityIcon}>
            <SecuritySection />
          </SettingsSection>

          <SettingsSection id="appearance" title="Appearance" caption="Theme and language. Saved automatically." icon={AppearanceIcon}>
            <AppearanceSection />
          </SettingsSection>

          <SettingsSection id="dashboard" title="Dashboard" caption="Home dashboard preferences. Saved automatically." icon={DashboardIcon}>
            <DashboardPrefs />
          </SettingsSection>

          <SettingsSection
            id="integrations"
            title="MeroShare Integration"
            caption="IPO auto-apply and account management live on the IPO page."
            icon={IntegrationIcon}
          >
            <MeroshareCard />
          </SettingsSection>

          <div className="mt-8 pt-4 border-t border-red-200 dark:border-red-900/50" />

          <SettingsSection
            id="danger"
            title="Danger zone"
            caption="Irreversible actions."
            tone="danger"
            icon={DangerIcon}
          >
            <DangerZone />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
