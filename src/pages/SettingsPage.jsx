// === SettingsPage.jsx — orchestrator only: page header + 3 titled sections ===
// Wave 1 (SET-2) ships the shell with placeholder bodies; Wave 2 (SET-3/4/5) fills each
// section with real controls (Appearance theme/language, Dashboard prefs, MeroShare static
// card). This page performs ZERO network activity — no api/index.js import, no fetch, no
// network-triggering effect — identity/account stays on ProfilePage.
import SettingsSection from '../components/settings/SettingsSection'
import AppearanceSection from '../components/settings/AppearanceSection'

const PLACEHOLDER = 'Available in this update.'

export default function SettingsPage() {
  return (
    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">
          <span aria-hidden="true">⚙️</span> Settings
        </h1>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          App preferences. Your identity and account stay in Profile.
        </p>
      </div>

      <div className="space-y-4">
        <SettingsSection id="appearance" title="Appearance" caption="Theme and language.">
          <AppearanceSection />
        </SettingsSection>

        <SettingsSection id="dashboard" title="Dashboard" caption="Home dashboard preferences.">
          <p className="text-[12px] text-gray-400 dark:text-gray-500">{PLACEHOLDER}</p>
        </SettingsSection>

        <SettingsSection
          id="integrations"
          title="MeroShare Integration"
          caption="IPO auto-apply and account management live on the IPO page."
        >
          <p className="text-[12px] text-gray-400 dark:text-gray-500">{PLACEHOLDER}</p>
        </SettingsSection>
      </div>
    </div>
  )
}
