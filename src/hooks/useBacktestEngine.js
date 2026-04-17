import { useRef, useCallback, useEffect } from 'react'
import { btExitOrder, btLogBehavior } from '../api/backtest'

/**
 * Backtest playback engine.
 * Handles candle-by-candle advancement, SL/TP checks, T+2 settlement.
 *
 * Uses refs for all mutable state to avoid stale closures inside setInterval.
 */
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
}) {
  const playingRef    = useRef(false)
  const speedRef      = useRef(1)
  const timerRef      = useRef(null)
  const speedTimerRef = useRef(null)   // pending setSpeed restart
  const cursorRef     = useRef(cursorIndex)
  const candlesRef    = useRef(candles)
  const sessionRef    = useRef(session)
  const scriptRef     = useRef(currentScript)

  // Keep all refs in sync on every render
  cursorRef.current  = cursorIndex
  candlesRef.current = candles
  sessionRef.current = session
  scriptRef.current  = currentScript

  // ── Internal pause ────────────────────────────────────────────────────────────
  const pauseInternal = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  // ── Process a single candle ───────────────────────────────────────────────────
  const processCandle = useCallback(async (candle, index) => {
    const sess   = sessionRef.current
    const script = scriptRef.current
    if (!sess || !candle) return

    // 1. Settle positions whose settlement_date <= candle.date
    await settlePositions(candle.date)

    // 2. Read open positions from ref (always fresh after settlePositions updates)
    //    We re-read scriptRef after await so we see the settled updates
    const openPositions = (scriptRef.current?.positions || []).filter(
      p => p.status === 'OPEN' || p.status === 'PARTIAL'
    )

    for (const pos of openPositions) {
      const sl      = pos.sl ? parseFloat(pos.sl) : null
      const tp      = pos.tp ? parseFloat(pos.tp) : null
      const settled = pos.settled || pos.settlement_date?.slice(0, 10) <= candle.date

      // ── SL check ─────────────────────────────────────────────────────────────
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
                  try {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date:  candle.date,
                      exit_price: candle.close,
                      reason:     'EARLY_EXIT',
                    })
                    closePositionLocal(pos.id, res.data)
                    await btLogBehavior(sess.id, {
                      order_id:   pos.id,
                      event_date: candle.date,
                      event_type: 'EARLY_EXIT',
                      symbol:     pos.symbol,
                      detail:     { sl, low: candle.low },
                    }).catch(() => {})
                  } catch {}
                },
              },
              {
                label: 'Ignore — Wait for Settlement',
                action: async () => {
                  await btLogBehavior(sess.id, {
                    order_id:   pos.id,
                    event_date: candle.date,
                    event_type: 'SL_IGNORED',
                    symbol:     pos.symbol,
                    detail:     { sl, low: candle.low },
                  }).catch(() => {})
                },
              },
              { label: 'Keep Position', action: () => {} },
            ],
          })
          return // pause — wait for user
        }

        // Post-settlement SL breach
        if (sess.sl_mode === 'AUTO') {
          try {
            const exitPrice = candle.open < sl ? candle.open : sl
            const res = await btExitOrder(sess.id, pos.id, {
              exit_date:  candle.date,
              exit_price: exitPrice,
              reason:     'SL_HIT',
            })
            closePositionLocal(pos.id, res.data)
          } catch {}
            continue
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
                  try {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date:  candle.date,
                      exit_price: sl,
                      reason:     'SL_HIT',
                    })
                    closePositionLocal(pos.id, res.data)
                  } catch {}
                },
              },
              {
                label: `Close at Today's Close Rs.${candle.close}`,
                action: async () => {
                  try {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date:  candle.date,
                      exit_price: candle.close,
                      reason:     'SL_HIT',
                    })
                    closePositionLocal(pos.id, res.data)
                  } catch {}
                },
              },
              {
                label: 'Ignore — Keep Position',
                action: async () => {
                  await btLogBehavior(sess.id, {
                    order_id:   pos.id,
                    event_date: candle.date,
                    event_type: 'SL_IGNORED',
                    symbol:     pos.symbol,
                    detail:     { sl, low: candle.low },
                  }).catch(() => {})
                },
              },
            ],
          })
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
                  try {
                    const res = await btExitOrder(sess.id, pos.id, {
                      exit_date:  candle.date,
                      exit_price: candle.close,
                      reason:     'EARLY_EXIT',
                    })
                    closePositionLocal(pos.id, res.data)
                    await btLogBehavior(sess.id, {
                      order_id:   pos.id,
                      event_date: candle.date,
                      event_type: 'EARLY_EXIT',
                      symbol:     pos.symbol,
                      detail:     { tp, high: candle.high },
                    }).catch(() => {})
                  } catch {}
                },
              },
              { label: 'Keep Position', action: () => {} },
            ],
          })
          return
        }

        // TP hit after settlement — auto-close
        try {
          const exitPrice = candle.open > tp ? candle.open : tp
          const res = await btExitOrder(sess.id, pos.id, {
            exit_date:  candle.date,
            exit_price: exitPrice,
            reason:     'TP_HIT',
          })
          closePositionLocal(pos.id, res.data)
        } catch {}
      }
    }

    // 3. Advance cursor
    const nextIndex = index + 1
    advanceCursor(nextIndex, candle.date)

    // 4. Check end of data
    if (nextIndex >= candlesRef.current.length) {
      playingRef.current = false
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      onDataEnd()
    }
  }, [settlePositions, advanceCursor, closePositionLocal, onSLBreach, onTPHit, onDataEnd, pauseInternal])

  // ── Public: Play ──────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (playingRef.current) return
    if (cursorRef.current >= candlesRef.current.length) return

    playingRef.current = true
    const ms = 1000 / parseFloat(speedRef.current)

    timerRef.current = setInterval(async () => {
      if (!playingRef.current) { clearInterval(timerRef.current); timerRef.current = null; return }
      const idx    = cursorRef.current
      const candle = candlesRef.current[idx]
      if (!candle) { pauseInternal(); onDataEnd(); return }
      await processCandle(candle, idx)
    }, ms)
  }, [processCandle, pauseInternal, onDataEnd])

  // ── Public: Pause ─────────────────────────────────────────────────────────────
  const pause = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  // ── Public: Step forward (manual mode) ───────────────────────────────────────
  const stepForward = useCallback(async () => {
    if (playingRef.current) return
    const idx    = cursorRef.current
    const candle = candlesRef.current[idx]
    if (!candle) { onDataEnd(); return }
    await processCandle(candle, idx)
  }, [processCandle, onDataEnd])

  // ── Public: Set speed ─────────────────────────────────────────────────────────
  const setSpeed = useCallback((s) => {
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
  }, [pause, play])

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current)      { clearInterval(timerRef.current);  timerRef.current = null }
      if (speedTimerRef.current) { clearTimeout(speedTimerRef.current); speedTimerRef.current = null }
    }
  }, [])

  return {
    play,
    pause,
    stepForward,
    setSpeed,
  }
}
