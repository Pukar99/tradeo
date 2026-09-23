// === AppearanceSection.jsx — Theme + Language segmented controls ===
// Renders inside the existing "appearance" SettingsSection (SettingsPage.jsx). Binds directly
// to ThemeContext/LanguageContext — the SAME contexts Navbar's quick-toggles use, so state is
// shared (two-way sync is inherent, not built here) and persistence works exactly as it does
// today (each context writes its own localStorage key on change). No local state, no network,
// no new store (ADR-04).
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'

// Tab-pill tokens — copied verbatim from design.md §1 (wrapper/chip/active strings), sized up
// to a 44px touch target per row (padding only — colors/shape are the token, untouched).
const PILL_WRAP = 'inline-flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5'
const PILL_BASE =
  'min-h-[44px] px-4 flex items-center justify-center rounded-md text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
const PILL_ACTIVE = 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
const PILL_INACTIVE =
  'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'

const ROW_LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'

export default function AppearanceSection() {
  const { isDark, toggleTheme } = useTheme()
  const { isNepali, toggleLang } = useLanguage()

  return (
    <div className="space-y-4">
      <div role="group" aria-labelledby="appearance-theme-label">
        <p id="appearance-theme-label" className={`${ROW_LABEL} mb-1.5`}>
          Theme
        </p>
        <div className={PILL_WRAP}>
          <button
            type="button"
            onClick={() => isDark && toggleTheme()}
            aria-pressed={!isDark}
            className={`${PILL_BASE} ${!isDark ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => !isDark && toggleTheme()}
            aria-pressed={isDark}
            className={`${PILL_BASE} ${isDark ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            Dark
          </button>
        </div>
      </div>

      <div role="group" aria-labelledby="appearance-language-label">
        <p id="appearance-language-label" className={`${ROW_LABEL} mb-1.5`}>
          Language
        </p>
        <div className={PILL_WRAP}>
          <button
            type="button"
            onClick={() => isNepali && toggleLang()}
            aria-pressed={!isNepali}
            className={`${PILL_BASE} ${!isNepali ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => !isNepali && toggleLang()}
            aria-pressed={isNepali}
            className={`${PILL_BASE} ${isNepali ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            नेपाली
          </button>
        </div>
      </div>
    </div>
  )
}
