// === ReplayMode.jsx — chart replay mode: symbol + date setup, candle-by-candle playback, keyboard controls ===
// Moved from src/components/screen/ReplayPage.jsx (SCR-10, Wave 5): Replay is no longer
// its own ScreenPage tab — it's a mode inside the merged "Backtesting" tab, toggled via
// BacktestPage.jsx's `mode` state. This file keeps ALL of Replay's original behavior
// byte-identical (setup screen, playback engine, keyboard shortcuts, Reset/New Replay,
// end-of-data banner) — the only addition is the `onExit` prop + the mode toggle shown
// at the top of the setup screen only (hidden once a replay is actively running).

import { useState, useCallback, useEffect } from 'react'
import { btGetOHLCV } from '../../api/backtest'
import BacktestChart from './BacktestChart'
import BacktestControls from './BacktestControls'
import ModeToggle from './ModeToggle'
import SymbolSearch from '../common/SymbolSearch'
import { nptToday } from '../../utils/nepseCalendar'
import { usePlaybackEngine } from '../../hooks/usePlaybackEngine'
import { useAuth } from '../../context/AuthContext'
import { TIER_ACCENT, getDisplayTier, TierAccentOverlay, tierRingClass } from '../common/TierMaterial'

// Setup-card icon — same 12x12 stroke recipe as BacktestHome's ICONS /
// ProfessionalAnalysisPanels' CardIcon (viewBox 0 0 24 24, stroke currentColor,
// strokeWidth 2.4, w-3 h-3). A circular "history/replay" arrow — CardIcon has no
// entry for this concept, so drawn fresh rather than borrowed.
const REPLAY_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3 h-3"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3.5 2" />
  </svg>
)

// ── ReplayMode ────────────────────────────────────────────────────────────────
// onExit — called when the mode toggle (shown only on the setup screen) is switched
// back to "Live Backtest". BacktestPage.jsx passes `() => setMode('backtest')`.

export default function ReplayMode({ onExit }) {
  // Setup state
  const [symbol, setSymbol] = useState('')
  const [startDate, setStartDate] = useState('')
  const [ready, setReady] = useState(false)

  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]

  // Playback state
  const [candles, setCandles] = useState([])
  const [cursorIndex, setCursorIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ended, setEnded] = useState(false)

  // ── Engine callbacks ──────────────────────────────────────────────────────────

  const handleAdvance = useCallback((nextIdx) => {
    setCursorIndex(nextIdx)
  }, [])

  const handleEnd = useCallback(() => {
    setIsPlaying(false)
    setEnded(true)
  }, [])

  // Thin tick callback — no SL/TP, no settlement, no backend calls. Just advance
  // the cursor and, if that lands on the last candle, stop immediately (via the
  // `pause` usePlaybackEngine hands in) rather than waiting for the next tick to
  // notice there's no candle left.
  const handleTick = useCallback(
    (candle, idx, { total, pause }) => {
      handleAdvance(idx, candle?.date || '')
      if (idx >= total - 1) {
        pause()
        handleEnd()
      }
    },
    [handleAdvance, handleEnd]
  )

  const engine = usePlaybackEngine({
    candles,
    cursorIndex,
    onTick: handleTick,
    onEnd: handleEnd,
    onStepBack: (newIndex, candle) => handleAdvance(newIndex, candle?.date || ''),
  })

  // ── Load OHLCV ───────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!symbol) {
      setError('Please select a symbol')
      return
    }
    if (!startDate) {
      setError('Please select a start date')
      return
    }

    setLoading(true)
    setError('')
    setEnded(false)
    setIsPlaying(false)
    setCursorIndex(0)

    try {
      const res = await btGetOHLCV(symbol, startDate, nptToday())
      const all = res.data.candles || []
      if (all.length === 0) {
        setError(`No data found for ${symbol} from ${startDate}`)
        setLoading(false)
        return
      }
      setCandles(all)
      setCursorIndex(0)
      setReady(true)
    } catch {
      setError('Failed to load chart data. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    engine.pause()
    setIsPlaying(false)
    setCursorIndex(0)
    setEnded(false)
  }

  // ── Playback controls ─────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    setEnded(false)
    engine.play()
  }, [engine])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    engine.pause()
  }, [engine])

  const handleStep = useCallback(() => {
    setIsPlaying(false)
    engine.stepForward()
  }, [engine])

  const handleStepBack = useCallback(() => {
    setIsPlaying(false)
    engine.stepBack()
  }, [engine])

  const handleSpeedChange = useCallback(
    (s) => {
      setSpeedState(s)
      engine.setSpeed(s)
    },
    [engine]
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!ready) return
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        isPlaying ? handlePause() : handlePlay()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleStepBack()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [ready, isPlaying, handlePlay, handlePause, handleStep, handleStepBack])

  const currentCandle = candles[cursorIndex] || null
  const currentDate = currentCandle?.date || ''

  // ── Setup screen — mode toggle shown here only (hidden once ready/playing) ───

  if (!ready) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white dark:bg-gray-950 px-4">
        <ModeToggle mode="replay" onChange={(m) => m === 'backtest' && onExit?.()} />
        {/* Single well-designed Card-shell-styled panel — one form, not a list, so a
            full CardStack of many cards would be overkill. Matches BacktestHome's new
            visual weight (stripe + tinted icon badge + bold title) so switching modes
            doesn't jump between two different design languages. */}
        <div
          className={`group relative w-full max-w-sm overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 shadow-sm animate-fade-up ${accent ? tierRingClass(displayTier) : ''}`}
        >
          <TierAccentOverlay accent={accent} radius="rounded-t-2xl" />
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500"
          />
          <div className="pl-4 pr-5 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                {REPLAY_ICON}
              </span>
              <div>
                <h2 className="text-[13px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                  Chart Replay
                </h2>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Watch candles unfold from a chosen date — no orders, just observation.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                  Symbol
                </label>
                <SymbolSearch
                  value={symbol}
                  stocksOnly
                  placeholder="Symbol (e.g. NABIL)"
                  inputClassName="w-40"
                  onSelect={(sym) => setSymbol(sym)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={nptToday()}
                  className="w-full px-3 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 rounded-lg
                             bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-2 text-[12px] font-semibold bg-blue-600 text-white rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading…' : 'Start Replay'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Replay screen ─────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-gray-950">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{symbol}</span>
          <span className="text-[10px] text-gray-400">from {startDate}</span>
          <span className="text-[10px] text-gray-400">{candles.length} candles</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700
                       text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => {
              engine.pause()
              setReady(false)
              setCandles([])
              setCursorIndex(0)
              setIsPlaying(false)
              setEnded(false)
            }}
            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700
                       text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ← New Replay
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <BacktestChart candles={candles} cursorIndex={cursorIndex} positions={[]} />
        </div>
      </div>

      {/* Controls */}
      <BacktestControls
        playing={isPlaying}
        speed={speed}
        cursorIndex={cursorIndex}
        totalCandles={candles.length}
        currentDate={currentDate}
        onPlay={handlePlay}
        onPause={handlePause}
        onStep={handleStep}
        onStepBack={handleStepBack}
        onSpeedChange={handleSpeedChange}
      />

      {/* End banner */}
      {ended && (
        <div
          className="shrink-0 flex items-center justify-center gap-3 px-4 py-2
                        bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800"
        >
          <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
            End of data — {candles.length} candles replayed
          </span>
          <button
            onClick={handleReset}
            className="px-2.5 py-0.5 text-[10px] font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  )
}
