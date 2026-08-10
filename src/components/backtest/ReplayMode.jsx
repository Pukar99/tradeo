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

// ── ReplayMode ────────────────────────────────────────────────────────────────
// onExit — called when the mode toggle (shown only on the setup screen) is switched
// back to "Live Backtest". BacktestPage.jsx passes `() => setMode('backtest')`.

export default function ReplayMode({ onExit }) {
  // Setup state
  const [symbol, setSymbol] = useState('')
  const [startDate, setStartDate] = useState('')
  const [ready, setReady] = useState(false)

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
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-bold text-gray-800 dark:text-gray-100 mb-0.5">
              Chart Replay
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Watch candles unfold from a chosen date — no orders, just observation.
            </p>
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
                           bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none
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
