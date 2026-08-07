// === ActionPanel.jsx — shared shell for the inline confirm panels in the ===
// === admin user list (change tier / suspend / force logout).             ===
//
// Visual pass 2026-08-08. These three panels used to each render their own
// full-bleed flat colour band (amber / red / green) spanning the whole row
// width, which shouted louder than the destructive action itself warranted
// and left the list looking striped whenever one was open. They now share an
// inset card with a 3px tone edge, so the panel reads as "attached to this
// row" without repainting the table.
//
// Presentational only — every caller keeps its own state, validation and API
// call. This exists because the same shell was about to be triplicated across
// three files; the tone/label/body/footer are all still the caller's call.

const TONE = {
  amber: {
    bar: 'bg-amber-500',
    confirm: 'bg-amber-600 hover:bg-amber-700',
  },
  red: {
    bar: 'bg-red-500',
    confirm: 'bg-red-600 hover:bg-red-700',
  },
  green: {
    bar: 'bg-emerald-500',
    confirm: 'bg-emerald-600 hover:bg-emerald-700',
  },
}

// Small uppercase label above a control group — the LABEL(form) token from
// pm/docs/design.md §1, minus the block/mb since the caller lays these out.
export function PanelLabel({ children }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
      {children}
    </span>
  )
}

export default function ActionPanel({
  tone = 'amber',
  title,
  subject,
  children,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  loadingLabel = 'Saving…',
  loading = false,
  disabled = false,
}) {
  const t = TONE[tone] || TONE.amber

  return (
    <div className="px-4 pt-1 pb-3.5 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
      <div className="relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm animate-slide-down">
        <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.bar}`} />
        <div className="py-3 pl-4 pr-3.5">
          <p className="text-[11px] font-semibold text-gray-900 dark:text-white mb-2.5">
            {title}
            {subject && (
              <span className="font-medium text-gray-500 dark:text-gray-400"> — {subject}</span>
            )}
          </p>

          {children}

          <div className="flex items-center justify-end gap-1 mt-3">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || disabled}
              className={`px-3.5 py-1.5 text-[11px] font-semibold text-white rounded-lg disabled:opacity-40 transition-colors ${t.confirm}`}
            >
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
