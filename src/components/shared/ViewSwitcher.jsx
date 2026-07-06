// =============================================================================
// ViewSwitcher.jsx — compact center-column view toggle (DataLab redesign S1).
// Spec §5: the center always fits one screen; deep content is a sibling VIEW,
// not a scroll. Styling = design.md "Tab pills" token, verbatim.
// =============================================================================

export default function ViewSwitcher({ views, active, onChange, ariaLabel = 'View' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0"
    >
      {views.map((v) => {
        const isActive = v.id === active
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(v.id)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
