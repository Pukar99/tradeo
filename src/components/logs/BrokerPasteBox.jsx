// === BrokerPasteBox.jsx — shared broker-SMS paste box for exit modals ===
// Renders a dashed paste area; once a message parses, shows a summary + Fill button.

export default function BrokerPasteBox({
  brokerText,
  parsed,
  summary,
  onChange,
  onFill,
  onClear,
  placeholder,
}) {
  return (
    <div className="px-4 sm:px-6 pt-4">
      <div
        className={`rounded-xl border-2 border-dashed transition-all ${
          parsed
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
        }`}
      >
        {parsed ? (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">{summary}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onFill}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors"
              >
                Fill form ↓
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <textarea
            value={brokerText}
            onChange={onChange}
            placeholder={placeholder}
            rows={2}
            className="w-full px-4 py-3 bg-transparent text-[11px] text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none"
          />
        )}
      </div>
    </div>
  )
}
