// =============================================================================
// usePlaybackEngine.js — shared candle-by-candle timer core (SCR-11)
// =============================================================================
// Extracted from useBacktestEngine.js + ReplayMode.jsx's inline `useReplayEngine`.
// Both hooks hand-rolled the exact same play/pause/step/speed timer skeleton
// (same ref shapes, same interval + debounced-speed-restart logic) and only
// differed in what happens ON a tick:
//   - Replay advances the cursor itself, synchronously, with no side effects.
//   - Backtest's tick is ASYNC — it awaits settlement, may pause mid-tick on an
//     SL/TP breach, and must guard against the interval firing again before the
//     previous tick's await resolves (interval-stacking).
//
// This hook owns ONLY the generic timer: it does not know about candles' OHLC
// meaning, SL/TP, settlement, or backend calls. It drives the interval and, on
// every tick (interval-fired or manual step), calls the caller-supplied
// `onTick(candle, index, { total, pause })` — the caller decides how/whether to
// advance the cursor, and can call the provided `pause` to stop playback
// immediately (e.g. on reaching the last candle, or on a breach) rather than
// waiting for the next tick to notice.
//
// `guardConcurrent: true` reinstates the processingRef guard that
// useBacktestEngine relied on to prevent interval-stacking around its async
// `processCandle` — that guard is load-bearing there (see useBacktestEngine.js)
// and is NOT dropped, just centralized here. Replay's tick is synchronous so it
// doesn't need it and leaves the flag off (default false).
// =============================================================================

import { useRef, useCallback, useEffect } from 'react'

export function usePlaybackEngine({
  candles,
  cursorIndex,
  onTick,
  onEnd,
  onStepBack,
  canStepBack: extraCanStepBack,
  guardConcurrent = false,
}) {
  const playingRef = useRef(false)
  const processingRef = useRef(false) // guard against concurrent onTick calls (opt-in)
  const speedRef = useRef(1)
  const timerRef = useRef(null)
  const speedTimerRef = useRef(null) // pending setSpeed restart
  const cursorRef = useRef(cursorIndex)
  const candlesRef = useRef(candles)

  // Keep all refs in sync on every render
  cursorRef.current = cursorIndex
  candlesRef.current = candles

  const pause = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Run one tick's worth of caller work, optionally serialized against
  // overlapping calls. `pause` is handed to the caller so it can stop playback
  // immediately from inside its own tick logic (breach, end-of-data, etc).
  const runTick = useCallback(
    async (candle, idx) => {
      if (guardConcurrent) {
        if (processingRef.current) return
        processingRef.current = true
      }
      try {
        await onTick(candle, idx, { total: candlesRef.current.length, pause })
      } finally {
        if (guardConcurrent) processingRef.current = false
      }
    },
    [onTick, guardConcurrent, pause]
  )

  const play = useCallback(() => {
    if (playingRef.current) return
    if (cursorRef.current >= candlesRef.current.length - 1) return

    playingRef.current = true
    const ms = 1000 / parseFloat(speedRef.current)

    timerRef.current = setInterval(async () => {
      if (!playingRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
        return
      }
      const idx = cursorRef.current + 1
      const candle = candlesRef.current[idx]
      if (!candle) {
        pause()
        onEnd?.()
        return
      }
      await runTick(candle, idx)
    }, ms)
  }, [runTick, pause, onEnd])

  const stepForward = useCallback(async () => {
    if (playingRef.current) return
    const idx = cursorRef.current + 1
    const candle = candlesRef.current[idx]
    if (!candle) {
      onEnd?.()
      return
    }
    await runTick(candle, idx)
  }, [runTick, onEnd])

  // ── Step back ───────────────────────────────────────────────────────────────
  // Generic guard is "not playing and not already at the first candle"; callers
  // can layer an extra guard (e.g. useBacktestEngine blocks step-back once any
  // position exists — settlements/exits can't be undone, see that file).
  const canStepBack = useCallback(() => {
    return !playingRef.current && cursorRef.current > 0 && (extraCanStepBack ? extraCanStepBack() : true)
  }, [extraCanStepBack])

  const stepBack = useCallback(() => {
    if (!canStepBack()) return
    const newIndex = cursorRef.current - 1
    const candle = candlesRef.current[newIndex]
    if (!candle) return
    onStepBack?.(newIndex, candle)
  }, [canStepBack, onStepBack])

  const setSpeed = useCallback(
    (s) => {
      speedRef.current = parseFloat(s)
      if (playingRef.current) {
        pause()
        // Cancel any pending restart from a previous speed change
        if (speedTimerRef.current) clearTimeout(speedTimerRef.current)
        speedTimerRef.current = setTimeout(() => {
          speedTimerRef.current = null
          play()
        }, 50)
      }
    },
    [pause, play]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (speedTimerRef.current) {
        clearTimeout(speedTimerRef.current)
        speedTimerRef.current = null
      }
    }
  }, [])

  return {
    play,
    pause,
    stepForward,
    stepBack,
    canStepBack,
    setSpeed,
  }
}
