// === SettingsSection.jsx — reusable CARD-token wrapper for a titled Settings section ===
// Renders a semantic <section aria-labelledby> around a CARD-token surface, with an <h2>
// heading + optional muted caption. SET-3/4/5 (Wave 2) reuse this for Appearance / Dashboard /
// Integrations content — this file stays orchestration-free (no fetching, no state).
const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'

export default function SettingsSection({ id, title, caption, children }) {
  const headingId = `${id}-heading`
  return (
    <section aria-labelledby={headingId} className="scroll-mt-20">
      <div className={`${CARD} p-5 sm:p-6`}>
        <h2
          id={headingId}
          className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight"
        >
          {title}
        </h2>
        {caption && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{caption}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  )
}
