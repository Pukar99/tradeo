const SPEEDS = ['0.5', '1', '2', '5', '10']

export default function BacktestControls({
  playing, speed, cursorIndex, totalCandles, currentDate,
  onPlay, onPause, onStep, onStepBack, onSpeedChange,
}) {
  const progress = totalCandles > 0 ? Math.round((cursorIndex / totalCandles) * 100) : 0
  const atEnd    = totalCandles > 0 && cursorIndex >= totalCandles - 1
  const atStart  = cursorIndex <= 0

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0 text-[10px]">

      {/* Playback buttons */}
      <div className="flex items-center gap-0.5">
        {/* Step back */}
        <button
          onClick={onStepBack}
          disabled={playing || atStart}
          title="Step back ← (ArrowLeft)"
          className="w-7 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-700 dark:text-gray-300 text-[9px] font-bold"
        >
          ←1
        </button>

        {/* Pause */}
        <button
          onClick={onPause}
          disabled={!playing}
          title="Pause (Space)"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-700 dark:text-gray-300"
        >
          ⏸
        </button>

        {/* Play */}
        <button
          onClick={onPlay}
          disabled={playing || atEnd}
          title="Play (Space)"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-700 dark:text-gray-300"
        >
          ▶
        </button>

        {/* Step forward */}
        <button
          onClick={onStep}
          disabled={playing || atEnd}
          title="Step forward → (ArrowRight)"
          className="w-7 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-700 dark:text-gray-300 text-[9px] font-bold"
        >
          1→
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        <span className="text-gray-400 text-[9px]">Speed:</span>
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
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
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 min-w-0">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-gray-500 dark:text-gray-400 text-[9px] tabular-nums whitespace-nowrap shrink-0">
          {cursorIndex}/{totalCandles}
        </span>
      </div>

      {/* Date */}
      <div className="text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap text-[9px] shrink-0">
        📅 {currentDate || '—'}
      </div>

      {atEnd && (
        <div className="text-orange-500 font-semibold text-[9px] whitespace-nowrap animate-pulse shrink-0">
          ● End
        </div>
      )}
    </div>
  )
}
