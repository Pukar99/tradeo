// =============================================================================
// useBacktestEngine.js — Backtest candle-by-candle playback engine
// =============================================================================
// Sections:
//   1. Refs             — playing, processing, speed, timer, cursor, candles
//   2. processCandle    — SL/TP checks, settlement, cursor advance
//   3. Public API       — play, pause, stepForward, stepBack, setSpeed
//   4. Cleanup          — unmount timer teardown
// =============================================================================
// All mutable state is in refs to avoid stale closures inside setInterval.
// processingRef guards against concurrent processCandle calls from the interval.
// SL takes priority over TP: if both hit on the same candle, SL closes first.
// =============================================================================

import { useRef, useCallback, useEffect } from 'react'
import { btExitOrder, btLogBehavior } from '../api/backtest'

export function useBacktestEngine({
  session,
  currentScript,
  candles,
  cursorIndex,
  advanceCursor,
  settlePositions,
  closePositionLocal,
  onSLBreach,
  onTPHit,
  onDataEnd,
  onActionError,
}) {
  const playingRef = useRef(false)
  const processingRef = useRef(false) // guard against concurrent processCandle calls
  const speedRef = useRef(1)
  const timerRef = useRef(null)
  const speedTimerRef = useRef(null) // pending setSpeed restart
  const cursorRef = useRef(cursorIndex)
  const candlesRef = useRef(candles)
  const sessionRef = useRef(session)
  const scriptRef = useRef(currentScript)

  // Keep all refs in sync on every render
  cursorRef.current = cursorIndex
  candlesRef.current = candles
  sessionRef.current = session
  scriptRef.current = currentScript

  // =============================================================================
  // 1. REFS — all mutable playback state
  // =============================================================================

  // (declared above — keep refs section header here for readability)

  // =============================================================================
  // 2. PROCESS CANDLE
  // =============================================================================

  const pauseInternal = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // ── Process a single candle ───────────────────────────────────────────────────
  const processCandle = useCallback(
    async (candle, index) => {
      // Guard: skip if already processing a candle (prevents interval stacking)
      if (processingRef.current) return
      processingRef.current = true

      const sess = sessionRef.current
      if (!sess || !candle) {
        processingRef.current = false
        return
      }

      // 1. Settle positions whose settlement_date <= candle.date
      const settlementFailures = await settlePositions(candle.date)
      if (settlementFailures?.length) {
        pauseInternal()
        onActionError?.(
          `Settlement failed repeatedly for ${settlementFailures.map((p) => p.symbol).join(', ')} — playback paused`
        )
        processingRef.current = false
        return
      }

      // 2. Read open positions from ref (always fresh after settlePositions updates)
      //    We re-read scriptRef after await so we see the settled updates
      const openPositions = (scriptRef.current?.positions || []).filter(
        (p) => p.status === 'OPEN' || p.status === 'PARTIAL'
      )

      for (const pos of openPositions) {
        const sl = pos.sl ? parseFloat(pos.sl) : null
        const tp = pos.tp ? parseFloat(pos.tp) : null
        const settled = pos.settled === true

        // ── SL check — `<=` so a candle low that touches OR breaches SL triggers ──
        // SL takes priority over TP: if both levels are hit on the same candle,
        // SL is processed first and the position is closed — TP check is skipped.
        if (sl !== null && candle.low <= sl) {
          if (!settled) {
            // Pre-settlement SL breach — prompt user
            pauseInternal()
            onSLBreach({
              pos,
              candle,
              preSettlement: true,
              options: [
                {
                  label: 'Close Early (EARLY_EXIT)',
                  action: async () => {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date: candle.date,
                      exit_price: candle.close,
                      reason: 'EARLY_EXIT',
                    })
                    closePositionLocal(pos.id, res.data)
                    await btLogBehavior(sess.id, {
                      order_id: pos.id,
                      event_date: candle.date,
                      event_type: 'EARLY_EXIT',
                      symbol: pos.symbol,
                      detail: { sl, low: candle.low },
                    }).catch(() => {})
                  },
                },
                {
                  label: 'Ignore — Wait for Settlement',
                  action: async () => {
                    await btLogBehavior(sess.id, {
                      order_id: pos.id,
                      event_date: candle.date,
                      event_type: 'SL_IGNORED',
                      symbol: pos.symbol,
                      detail: { sl, low: candle.low },
                    }).catch(() => {})
                  },
                },
                { label: 'Keep Position', action: () => {} },
              ],
            })
            processingRef.current = false
            return // pause — wait for user
          }

          // Post-settlement SL breach
          if (sess.sl_mode === 'AUTO') {
            try {
              const exitPrice = candle.open < sl ? candle.open : sl
              const res = await btExitOrder(sess.id, pos.id, {
                exit_date: candle.date,
                exit_price: exitPrice,
                reason: 'SL_HIT',
              })
              closePositionLocal(pos.id, res.data)
              continue // position closed — skip TP check for this pos
            } catch (err) {
              // The SL was hit but the exit failed server-side. Silently falling
              // through here would (a) leave the position open while we move on, and
              // (b) evaluate TP for a position the strategy already exited — desyncing
              // local state from the DB. Pause, surface the error, and stop processing
              // this candle so the user can retry rather than trade on a phantom fill.
              console.error('[Engine] AUTO SL exit failed for', pos.id, err?.message)
              pauseInternal()
              onActionError?.(
                err?.response?.data?.message ||
                  `Auto SL exit failed for ${pos.symbol} — playback paused`
              )
              processingRef.current = false
              return
            }
          }

          if (sess.sl_mode === 'MANUAL') {
            pauseInternal()
            onSLBreach({
              pos,
              candle,
              preSettlement: false,
              options: [
                {
                  label: `Close at SL Rs.${sl}`,
                  action: async () => {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date: candle.date,
                      exit_price: sl,
                      reason: 'SL_HIT',
                    })
                    closePositionLocal(pos.id, res.data)
                  },
                },
                {
                  label: `Close at Today's Close Rs.${candle.close}`,
                  action: async () => {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date: candle.date,
                      exit_price: candle.close,
                      reason: 'SL_HIT',
                    })
                    closePositionLocal(pos.id, res.data)
                  },
                },
                {
                  label: 'Ignore — Keep Position',
                  action: async () => {
                    await btLogBehavior(sess.id, {
                      order_id: pos.id,
                      event_date: candle.date,
                      event_type: 'SL_IGNORED',
                      symbol: pos.symbol,
                      detail: { sl, low: candle.low },
                    }).catch(() => {})
                  },
                },
              ],
            })
            processingRef.current = false
            return // pause for user
          }
        }

        // ── TP check (only after settlement) ───────────────────────────────────────
        if (tp !== null && candle.high >= tp) {
          if (!settled) {
            pauseInternal()
            onTPHit({
              pos,
              candle,
              preSettlement: true,
              options: [
                {
                  label: 'Close Early (EARLY_EXIT)',
                  action: async () => {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date: candle.date,
                      exit_price: candle.close,
                      reason: 'EARLY_EXIT',
                    })
                    closePositionLocal(pos.id, res.data)
                    await btLogBehavior(sess.id, {
                      order_id: pos.id,
                      event_date: candle.date,
                      event_type: 'EARLY_EXIT',
                      symbol: pos.symbol,
                      detail: { tp, high: candle.high },
                    }).catch(() => {})
                  },
                },
                { label: 'Keep Position', action: () => {} },
              ],
            })
            processingRef.current = false
            return
          }

          // TP hit after settlement — auto-close
          try {
            const exitPrice = candle.open > tp ? candle.open : tp
            const res = await btExitOrder(sess.id, pos.id, {
              exit_date: candle.date,
              exit_price: exitPrice,
              reason: 'TP_HIT',
            })
            closePositionLocal(pos.id, res.data)
          } catch (err) {
            // TP hit but exit failed — pause and surface rather than silently
            // leaving the position open (it would re-trigger every candle).
            console.error('[Engine] TP exit failed for', pos.id, err?.message)
            pauseInternal()
            onActionError?.(
              err?.response?.data?.message ||
                `Auto TP exit failed for ${pos.symbol} — playback paused`
            )
            processingRef.current = false
            return
          }
        }
      }

      // 3. Advance cursor
      advanceCursor(index, candle.date)

      // 4. Check end of data
      if (index >= candlesRef.current.length - 1) {
        playingRef.current = false
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        onDataEnd()
      }

      processingRef.current = false
    },
    [
      settlePositions,
      advanceCursor,
      closePositionLocal,
      onSLBreach,
      onTPHit,
      onDataEnd,
      onActionError,
      pauseInternal,
    ]
  )

  // =============================================================================
  // 3. PUBLIC API
  // =============================================================================

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
        pauseInternal()
        onDataEnd()
        return
      }
      await processCandle(candle, idx)
    }, ms)
  }, [processCandle, pauseInternal, onDataEnd])

  const pause = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stepForward = useCallback(async () => {
    if (playingRef.current) return
    const idx = cursorRef.current + 1
    const candle = candlesRef.current[idx]
    if (!candle) {
      onDataEnd()
      return
    }
    await processCandle(candle, idx)
  }, [processCandle, onDataEnd])

  // ── Step back ───────────────────────────────────────────────────────────────
  // IMPORTANT: step-back is a CHART-VIEW REWIND ONLY. It decrements the cursor so
  // the user can re-examine the prior candle, but it does NOT undo side effects that
  // were already applied while advancing forward — settlements (btSettleOrder),
  // SL/TP auto-closes and exits (btExitOrder) are committed to the backend and have
  // no inverse endpoint. Rewinding across a candle that mutated a position would
  // desync the chart cursor from position state.
  //
  // Guard: once the script has ANY position (open, partial, or closed), its
  // lifecycle was evaluated relative to the forward cursor path, so we block
  // step-back to prevent that desync. With zero positions the cursor is the only
  // state, so rewinding is fully safe. canStepBack() reflects this for the UI.
  const hasAnyPosition = useCallback(() => {
    return (scriptRef.current?.positions || []).length > 0
  }, [])

  const canStepBack = useCallback(() => {
    return !playingRef.current && cursorRef.current > 0 && !hasAnyPosition()
  }, [hasAnyPosition])

  const stepBack = useCallback(() => {
    if (!canStepBack()) return
    const idx = cursorRef.current
    const newIndex = idx - 1
    const candle = candlesRef.current[newIndex]
    if (!candle) return
    advanceCursor(newIndex, candle.date)
  }, [advanceCursor, canStepBack])

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

  // =============================================================================
  // 4. CLEANUP
  // =============================================================================

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
