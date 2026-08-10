// === ModeToggle.jsx — small pill toggle for the merged Backtesting tab's two modes ===
// Rendered above BacktestHome (Live Backtest mode, from BacktestPage.jsx) and at the top
// of ReplayMode's own setup screen (Replay mode). Each caller is responsible for hiding
// it once ITS mode has an active session/replay running — this component itself has no
// visibility logic, it's a dumb two-option pill matching ScreenPage.jsx's TabStrip look
// (bg-gray-100 rounded-lg p-0.5, active = bg-white shadow-sm) without pulling in
// TabStrip's sliding-indicator machinery (overkill for a static 2-option switch).

const OPTIONS = [
  { id: 'backtest', label: 'Live Backtest' },
  { id: 'replay', label: 'Replay' },
]

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-lg p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={mode === opt.id}
          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
            mode === opt.id
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
