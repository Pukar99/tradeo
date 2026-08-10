// =============================================================================
// useBacktestEngine.js — Backtest candle-by-candle playback engine
// =============================================================================
// Sections:
//   1. Refs             — session/script (business state only — the timer's own
//                          playing/speed/timer/cursor/candles refs now live in
//                          the shared usePlaybackEngine, see SCR-11)
//   2. processCandle    — SL/TP checks, settlement, cursor advance (this file's
//                          `onTick` callback for usePlaybackEngine)
//   3. Engine wiring     — usePlaybackEngine + step-back guard
// =============================================================================
// SL takes priority over TP: if both hit on the same candle, SL closes first.
// The processingRef guard against concurrent processCandle calls (interval
// firing again before a previous async processCandle resolves) now lives
// inside usePlaybackEngine (`guardConcurrent: true` below) — it is NOT dropped,
// just centralized so Replay's identical-shaped timer doesn't have to
// reimplement it.
// =============================================================================

import { useRef, useCallback } from 'react'
import { btExitOrder, btLogBehavior } from '../api/backtest'
import { usePlaybackEngine } from './usePlaybackEngine'

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
  const sessionRef = useRef(session)
  const scriptRef = useRef(currentScript)

  // Keep refs in sync on every render
  sessionRef.current = session
  scriptRef.current = currentScript

  // =============================================================================
  // 2. PROCESS CANDLE — usePlaybackEngine's onTick callback
  // =============================================================================
  // Called for every tick (interval-fired or a manual step). `pause` and `total`
  // are handed in by usePlaybackEngine itself — see that file. This function no
  // longer advances the timer or guards concurrency itself; usePlaybackEngine
  // does both (the guard via `guardConcurrent: true` below).

  const processCandle = useCallback(
    async (candle, index, { total, pause }) => {
      const sess = sessionRef.current
      if (!sess || !candle) {
        return
      }

      // 1. Settle positions whose settlement_date <= candle.date
      const settlementFailures = await settlePositions(candle.date)
      if (settlementFailures?.length) {
        pause()
        onActionError?.(
          `Settlement failed repeatedly for ${settlementFailures.map((p) => p.symbol).join(', ')} — playback paused`
        )
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
            pause()
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
              pause()
              onActionError?.(
                err?.response?.data?.message ||
                  `Auto SL exit failed for ${pos.symbol} — playback paused`
              )
              return
            }
          }

          if (sess.sl_mode === 'MANUAL') {
            pause()
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
            return // pause for user
          }
        }

        // ── TP check (only after settlement) ───────────────────────────────────────
        if (tp !== null && candle.high >= tp) {
          if (!settled) {
            pause()
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
            pause()
            onActionError?.(
              err?.response?.data?.message ||
                `Auto TP exit failed for ${pos.symbol} — playback paused`
            )
            return
          }
        }
      }

      // 3. Advance cursor
      advanceCursor(index, candle.date)

      // 4. Check end of data
      if (index >= total - 1) {
        pause()
        onDataEnd()
      }
    },
    [settlePositions, advanceCursor, closePositionLocal, onSLBreach, onTPHit, onDataEnd, onActionError]
  )

  // =============================================================================
  // 3. ENGINE WIRING
  // =============================================================================

  // ── Step back guard ────────────────────────────────────────────────────────
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

  const { play, pause, stepForward, stepBack, canStepBack, setSpeed } = usePlaybackEngine({
    candles,
    cursorIndex,
    onTick: processCandle,
    onEnd: onDataEnd,
    onStepBack: (newIndex, candle) => advanceCursor(newIndex, candle.date),
    canStepBack: () => !hasAnyPosition(),
    guardConcurrent: true, // load-bearing — prevents interval-stacking around async processCandle
  })

  return {
    play,
    pause,
    stepForward,
    stepBack,
    canStepBack,
    setSpeed,
  }
}
