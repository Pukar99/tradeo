// === AdminEmptyState.jsx — shared empty state for the admin list tabs ===
//
// Visual pass 2026-08-08. The lists previously rendered six grey words
// centred in a 420px void. This gives the state an icon, a real heading and a
// line of guidance, and keeps the height reservation so the card doesn't
// collapse when a filter matches nothing.
//
// `icon` is the SVG path content for a 24x24 stroke-2 glyph (the chrome-icon
// convention from pm/docs/design.md — emoji are banned as chrome glyphs).
export default function AdminEmptyState({ icon, title, hint }) {
  return (
    <div className="min-h-[420px] flex flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[280px]">{hint}</p>
      )}
    </div>
  )
}
