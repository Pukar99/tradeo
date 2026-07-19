// === ReplayPage.jsx — chart replay mode: symbol + date setup, candle-by-candle playback, keyboard controls ===

import { useState, useCallback, useRef, useEffect } from 'react'
import { btGetOHLCV } from '../../api/backtest'
import BacktestChart from '../backtest/BacktestChart'
import BacktestControls from '../backtest/BacktestControls'
import SymbolSearch from '../common/SymbolSearch'
import { nptToday } from '../../utils/nepseCalendar'

// ── Minimal replay engine (no session, no orders) ────────────────────────────
// Replicates the play/pause/step/speed logic from useBacktestEngine without
// any SL/TP checks, settlement, or backend calls.

function useReplayEngine({ candles, cursorIndex, onAdvance, onEnd }) {
  const playingRef = useRef(false)
  const speedRef = useRef(1)
  const timerRef = useRef(null)
  const speedTimerRef = useRef(null)
  const cursorRef = useRef(cursorIndex)
  const candlesRef = useRef(candles)

  cursorRef.current = cursorIndex
  candlesRef.current = candles

  const pauseInternal = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const idx = cursorRef.current
    if (idx >= candlesRef.current.length - 1) {
      pauseInternal()
      onEnd()
      return
    }
    const next = idx + 1
    onAdvance(next, candlesRef.current[next]?.date || '')
    if (next >= candlesRef.current.length - 1) {
      pauseInternal()
      onEnd()
    }
  }, [pauseInternal, onAdvance, onEnd])

  const play = useCallback(() => {
    if (playingRef.current) return
    if (cursorRef.current >= candlesRef.current.length - 1) return
    playingRef.current = true
    const ms = 1000 / parseFloat(speedRef.current)
    timerRef.current = setInterval(() => {
      if (!playingRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
        return
      }
      tick()
    }, ms)
  }, [tick])

  const pause = useCallback(() => {
    pauseInternal()
  }, [pauseInternal])

  const stepForward = useCallback(() => {
    if (playingRef.current) return
    tick()
  }, [tick])

  const stepBack = useCallback(() => {
    if (playingRef.current) return
    const idx = cursorRef.current
    if (idx <= 0) return
    onAdvance(idx - 1, candlesRef.current[idx - 1]?.date || '')
  }, [onAdvance])

  const setSpeed = useCallback(
    (s) => {
      speedRef.current = parseFloat(s)
      if (playingRef.current) {
        pauseInternal()
        if (speedTimerRef.current) clearTimeout(speedTimerRef.current)
        speedTimerRef.current = setTimeout(() => {
          speedTimerRef.current = null
          play()
        }, 50)
      }
    },
    [pauseInternal, play]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (speedTimerRef.current) clearTimeout(speedTimerRef.current)
    }
  }, [])

  return { play, pause, stepForward, stepBack, setSpeed, isPlayingRef: playingRef }
}

// ── ReplayPage ────────────────────────────────────────────────────────────────

export default function ReplayPage() {
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

  const engine = useReplayEngine({
    candles,
    cursorIndex,
    onAdvance: handleAdvance,
    onEnd: handleEnd,
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

  // ── Setup screen ──────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950">
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
