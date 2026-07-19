// === SettingsSection.jsx — reusable CARD-token wrapper for a titled Settings section ===
// Renders a semantic <section aria-labelledby> around a CARD-token surface, with an <h2>
// heading + optional muted caption. SET-3/4/5 (Wave 2) reuse this for Appearance / Dashboard /
// Integrations content — this file stays orchestration-free (no fetching, no state).
// SET-8 (Wave 3): optional `tone="danger"` swaps the border/title to red accents for the
// Danger zone section — additive, backward-compatible (default tone unchanged for every
// existing caller).
// SET-10 (Wave 4): optional `icon` slot (ReactNode) rendered left of the <h2>, DataLabPage
// glyph convention (24x24 stroke-2 inline SVG, DataLabPage.jsx:56-63) — decorative only,
// aria-hidden, sized via a wrapper span so callers don't need to know the w-6 h-6 class.
const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const CARD_DANGER =
  'bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50'

export default function SettingsSection({ id, title, caption, children, tone, icon }) {
  const headingId = `${id}-heading`
  const isDanger = tone === 'danger'
  return (
    <section aria-labelledby={headingId} className="scroll-mt-20">
      <div className={`${isDanger ? CARD_DANGER : CARD} p-5 sm:p-6`}>
        <div
          className={`flex items-center gap-2 ${
            isDanger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
          }`}
        >
          {icon && (
            <span aria-hidden="true" className="w-6 h-6 shrink-0">
              {icon}
            </span>
          )}
          <h2 id={headingId} className="text-[15px] font-bold tracking-tight">
            {title}
          </h2>
        </div>
        {caption && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{caption}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  )
}
