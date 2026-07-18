// === SettingsPage.jsx — orchestrator only: page header + titled sections ===
// Wave 1 (SET-2) shipped the shell with placeholder bodies; Wave 2 (SET-3/4/5) filled Appearance
// theme/language, Dashboard prefs, and the static MeroShare card. Wave 3 (SET-6+, owner-ordered
// 2026-07-19) moves identity/account editing here too — Profile becomes pure display. SET-6 added
// the Account section (avatar + profile fields); SET-7 added Security (password change); SET-8
// adds Danger zone (delete account) as the LAST section, red-toned via SettingsSection's
// tone="danger" prop. This page itself still performs ZERO network activity of its own —
// AccountSection owns its cached getProfile() call, SecuritySection/DangerZone call their APIs
// only on submit.
import SettingsSection from '../components/settings/SettingsSection'
import AppearanceSection from '../components/settings/AppearanceSection'
import DashboardPrefs from '../components/settings/DashboardPrefs'
import MeroshareCard from '../components/settings/MeroshareCard'
import AccountSection from '../components/settings/AccountSection'
import SecuritySection from '../components/settings/SecuritySection'
import DangerZone from '../components/settings/DangerZone'

export default function SettingsPage() {
  return (
    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">
          <span aria-hidden="true">⚙️</span> Settings
        </h1>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          App preferences and your account.
        </p>
      </div>

      <div className="space-y-4">
        <SettingsSection id="appearance" title="Appearance" caption="Theme and language.">
          <AppearanceSection />
        </SettingsSection>

        <SettingsSection id="dashboard" title="Dashboard" caption="Home dashboard preferences.">
          <DashboardPrefs />
        </SettingsSection>

        <SettingsSection
          id="integrations"
          title="MeroShare Integration"
          caption="IPO auto-apply and account management live on the IPO page."
        >
          <MeroshareCard />
        </SettingsSection>

        <SettingsSection
          id="account"
          title="Account"
          caption="Your profile details and avatar."
        >
          <AccountSection />
        </SettingsSection>

        <SettingsSection id="security" title="Security" caption="Change your password.">
          <SecuritySection />
        </SettingsSection>

        <SettingsSection
          id="danger"
          title="Danger zone"
          caption="Irreversible actions."
          tone="danger"
        >
          <DangerZone />
        </SettingsSection>
      </div>
    </div>
  )
}
