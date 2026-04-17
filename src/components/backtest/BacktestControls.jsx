const SPEEDS = ['0.5', '1', '2', '5', '10']

// SVG icons — no emoji, always visible on all OS/fonts
function IconPlay()  { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg> }
function IconPause() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 2h3v12H4V2zm5 0h3v12H9V2z"/></svg> }
function IconStepB() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M4 2h2v12H4V2zm2 6l7-5v10L6 8z"/></svg> }
function IconStepF() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 2h2v12h-2V2zm-2 6L1 3v10l7-5z"/></svg> }

export default function BacktestControls({
  playing, speed, cursorIndex, totalCandles, currentDate,
  onPlay, onPause, onStep, onStepBack, onSpeedChange,
}) {
  const progress = totalCandles > 0 ? Math.round((cursorIndex / totalCandles) * 100) : 0
  const atEnd    = totalCandles > 0 && cursorIndex >= totalCandles - 1
  const atStart  = cursorIndex <= 0

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">

      {/* ── Playback controls ─────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Step back */}
        <button
          onClick={onStepBack}
          disabled={playing || atStart}
          title="Step back (ArrowLeft)"
          className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <IconStepB />
        </button>

        {/* Play / Pause — single toggle button, always visible */}
        <button
          onClick={playing ? onPause : onPlay}
          disabled={!playing && atEnd}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          className={`w-9 h-7 flex items-center justify-center rounded-md border font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            playing
              ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        {/* Step forward */}
        <button
          onClick={onStep}
          disabled={playing || atEnd}
          title="Step forward (ArrowRight)"
          className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <IconStepF />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* ── Speed ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Speed</span>
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${
              speed === s
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* ── Progress bar ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 min-w-0 overflow-hidden">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap shrink-0">
          {cursorIndex}/{totalCandles}
        </span>
      </div>

      {/* ── Date ─────────────────────────────────────────────── */}
      <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap shrink-0">
        {currentDate || '—'}
      </div>

      {atEnd && (
        <span className="text-[9px] font-bold text-orange-500 whitespace-nowrap animate-pulse shrink-0">
          END
        </span>
      )}

      {/* ── Keyboard hint ─────────────────────────────────────── */}
      <div className="hidden lg:flex items-center gap-1 text-[8px] text-gray-300 dark:text-gray-600 shrink-0 ml-1">
        <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700">Space</kbd>
        <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700">←</kbd>
        <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700">→</kbd>
      </div>
    </div>
  )
}
