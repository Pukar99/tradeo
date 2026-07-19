// =============================================================================
// useBacktestSession.js — Active backtest session state manager
// =============================================================================
// Sections:
//   1. State & Refs         — session, script, candles, cursor
//   2. Local Mutations      — updatePositionLocal, addPositionLocal, closePositionLocal
//   3. Script / Session Ops — switchToScript, loadSession, advanceCursor, settlePositions
//   4. Lifecycle Callbacks  — onSessionStarted, onSessionEnded
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react'
import { apiError } from '../utils/format'
import { btGetSession, btGetOHLCV, btUpdateSession, btSettleOrder } from '../api/backtest'
import { nptToday } from '../utils/nepseCalendar'

// Coalesce cursor-persist writes to at most one per this interval (see persistTimerRef).
const PERSIST_INTERVAL_MS = 1500
// After this many consecutive settle failures for the same position, stop retrying
// every candle (avoids a silent infinite retry storm on a persistent server error).
const MAX_SETTLE_RETRIES = 3

// Manages the active backtest session: load/restore, OHLCV per script,
// cursor persistence, and local state mutations after orders.
export function useBacktestSession() {
  const [session, setSession] = useState(null)
  const [currentScript, setCurrentScript] = useState(null)
  const [candles, setCandles] = useState([])
  const [cursorIndex, setCursorIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // =============================================================================
  // 1. STATE & REFS
  // =============================================================================

  // Refs shadow state — used inside callbacks to avoid stale closures
  const sessionRef = useRef(null)
  const currentScriptRef = useRef(null)
  // Per-script OHLCV cache (keyed by script id) — switching back to an already-loaded
  // script (tab click) must NOT refetch the full candle window every time. Bounds
  // Supabase egress (quota ADR) and makes tab switches instant.
  const candleCacheRef = useRef({})
  // Throttle cursor persistence: at 10× playback advanceCursor fires every ~100ms;
  // persisting on every candle is a write storm. We coalesce writes to at most one
  // per PERSIST_INTERVAL_MS and always flush the latest on pause/unmount.
  const persistTimerRef = useRef(null)
  const pendingPersistRef = useRef(null)
  // Per-position settle-failure counter (see settlePositions / MAX_SETTLE_RETRIES).
  const settleRetriesRef = useRef({})

  const setSessionSynced = useCallback((val) => {
    const resolved = typeof val === 'function' ? val(sessionRef.current) : val
    sessionRef.current = resolved
    setSession(resolved)
  }, [])

  const setCurrentScriptSynced = useCallback(
    (val) => {
      const resolved = typeof val === 'function' ? val(currentScriptRef.current) : val
      currentScriptRef.current = resolved
      setCurrentScript(resolved)

      if (resolved?.id && sessionRef.current) {
        setSessionSynced((prev) => {
          if (!prev) return prev
          const scripts = prev.scripts || []
          const exists = scripts.some((script) => script.id === resolved.id)
          return {
            ...prev,
            active_script: resolved.symbol,
            scripts: exists
              ? scripts.map((script) => (script.id === resolved.id ? resolved : script))
              : [...scripts, resolved],
          }
        })
      }
    },
    [setSessionSynced]
  )

  // =============================================================================
  // 2. LOCAL MUTATIONS
  // =============================================================================

  const updatePositionLocal = useCallback(
    (orderId, changes) => {
      setCurrentScriptSynced((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          positions: (prev.positions || []).map((p) =>
            p.id === orderId ? { ...p, ...changes } : p
          ),
        }
      })
    },
    [setCurrentScriptSynced]
  )

  const addPositionLocal = useCallback(
    (order) => {
      setCurrentScriptSynced((prev) => {
        if (!prev) return prev
        return { ...prev, positions: [...(prev.positions || []), order] }
      })
      setSessionSynced((prev) => ({
        ...prev,
        available_capital: order.available_capital_after ?? prev.available_capital,
      }))
    },
    [setCurrentScriptSynced, setSessionSynced]
  )

  const closePositionLocal = useCallback(
    (orderId, exitData) => {
      setCurrentScriptSynced((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          positions: prev.positions.map((p) =>
            p.id === orderId ? { ...p, status: 'CLOSED', ...exitData } : p
          ),
        }
      })
      setSessionSynced((prev) => ({
        ...prev,
        available_capital: exitData.available_capital_after ?? prev.available_capital,
      }))
    },
    [setCurrentScriptSynced, setSessionSynced]
  )

  const updateCapitalLocal = useCallback(
    (newCapital) => {
      setSessionSynced((prev) => ({ ...prev, available_capital: newCapital }))
    },
    [setSessionSynced]
  )

  // =============================================================================
  // 3. SCRIPT / SESSION OPS
  // =============================================================================

  // Uses sessionRef to avoid stale closure — safe to call from loadSession
  const switchToScript = useCallback(
    async (sess, script) => {
      const sessToUse = sess || sessionRef.current
      if (!sessToUse || !script) return

      setCurrentScriptSynced(script)
      setCursorIndex(script.cursor_index || 0)

      // Serve from cache if this script's candles were already loaded this session.
      const cached = candleCacheRef.current[script.id]
      if (cached) {
        setCandles(cached)
        setCurrentScriptSynced((prev) => ({ ...prev, total_candles: cached.length }))
      } else {
        try {
          const res = await btGetOHLCV(script.symbol, script.start_date, nptToday())
          const allCandles = res.data.candles || []
          if (allCandles.length === 0) {
            setError(`No chart data found for ${script.symbol}. Check the date range.`)
          }
          candleCacheRef.current[script.id] = allCandles
          setCandles(allCandles)
          setCurrentScriptSynced((prev) => ({ ...prev, total_candles: allCandles.length }))
        } catch (err) {
          console.error('[Session] OHLCV fetch failed:', err?.message)
          setCandles([])
          setError(`Failed to load chart data for ${script.symbol}. Please try again.`)
        }
      }

      // Update session's active_script in backend (fire-and-forget)
      if (sessToUse.active_script !== script.symbol) {
        btUpdateSession(sessToUse.id, { active_script: script.symbol }).catch(() => {})
      }
    },
    [setCurrentScriptSynced]
  )

  // ── Load / restore session ────────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await btGetSession()
      const sess = res.data
      setSessionSynced(sess)

      const activeScript =
        sess.scripts?.find((s) => s.symbol === sess.active_script) || sess.scripts?.[0]
      if (activeScript) {
        await switchToScript(sess, activeScript)
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(apiError(err, 'Failed to load session'))
      }
    } finally {
      setLoading(false)
    }
  }, [setSessionSynced, switchToScript])

  // Flush the latest pending cursor position to the backend immediately.
  // NOTE: the key MUST be `current_date` — the backend PUT /session/:id destructures
  // `current_date: current_date_val`. Sending `current_date_val` left it undefined,
  // so the guard skipped the scripts update and cursor/date were never persisted.
  const flushPersist = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    const pending = pendingPersistRef.current
    if (!pending) return
    pendingPersistRef.current = null
    const sess = sessionRef.current
    if (!sess) return
    return btUpdateSession(sess.id, {
      script_id: pending.scriptId,
      cursor_index: pending.cursorIndex,
      current_date: pending.date,
    }).catch(() => {})
  }, [])

  const advanceCursor = useCallback(
    (newIndex, newDate) => {
      setCursorIndex(newIndex)
      setCurrentScriptSynced((prev) => {
        if (!prev) return prev
        return { ...prev, cursor_index: newIndex, current_date_val: newDate }
      })

      // Coalesce persistence (fire-and-forget). At 10× playback this fires every
      // ~100ms; without throttling that's a write storm against Supabase. We stash
      // the latest position and flush at most once per PERSIST_INTERVAL_MS; pause /
      // session-end / unmount flush the final value so nothing is lost.
      const sess = sessionRef.current
      const script = currentScriptRef.current
      if (sess && script) {
        pendingPersistRef.current = {
          scriptId: script.id,
          cursorIndex: newIndex,
          date: newDate,
        }
        if (!persistTimerRef.current) {
          persistTimerRef.current = setTimeout(() => {
            persistTimerRef.current = null
            flushPersist()
          }, PERSIST_INTERVAL_MS)
        }
      }
    },
    [setCurrentScriptSynced, flushPersist]
  )

  const settlePositions = useCallback(
    async (currentDate) => {
      const script = currentScriptRef.current
      const sess = sessionRef.current
      if (!script?.positions || !sess) return []
      const failed = []

      const toSettle = script.positions.filter(
        (p) =>
          !p.settled &&
          (p.status === 'OPEN' || p.status === 'PARTIAL') &&
          p.settlement_date?.slice(0, 10) <= currentDate &&
          (settleRetriesRef.current[p.id] || 0) < MAX_SETTLE_RETRIES
      )

      for (const pos of toSettle) {
        try {
          await btSettleOrder(sess.id, pos.id)
          updatePositionLocal(pos.id, { settled: true })
          delete settleRetriesRef.current[pos.id]
        } catch (err) {
          // Don't retry forever every candle on a persistent failure — count attempts
          // and give up after MAX_SETTLE_RETRIES so playback isn't a silent retry storm.
          settleRetriesRef.current[pos.id] = (settleRetriesRef.current[pos.id] || 0) + 1
          console.error('[Session] settle failed for', pos.id, err?.message)
          if (settleRetriesRef.current[pos.id] >= MAX_SETTLE_RETRIES) {
            failed.push(pos)
            // Playback is paused and the failure is surfaced. Keep one retry
            // available so an explicit user resume can recover after a transient
            // backend outage without restoring the old automatic retry storm.
            settleRetriesRef.current[pos.id] = MAX_SETTLE_RETRIES - 1
          }
        }
      }
      return failed
    },
    [updatePositionLocal]
  )

  // =============================================================================
  // 4. LIFECYCLE CALLBACKS
  // =============================================================================

  const onSessionStarted = useCallback(
    async (newSession) => {
      setSessionSynced(newSession)
      const firstScript = newSession.scripts?.[0]
      if (firstScript) {
        await switchToScript(newSession, firstScript)
      }
    },
    [setSessionSynced, switchToScript]
  )

  const onSessionEnded = useCallback(() => {
    flushPersist() // persist the final cursor before tearing down
    candleCacheRef.current = {}
    settleRetriesRef.current = {}
    setSessionSynced(null)
    setCurrentScriptSynced(null)
    setCandles([])
    setCursorIndex(0)
  }, [setSessionSynced, setCurrentScriptSynced, flushPersist])

  // Flush any pending cursor-persist on unmount so the last position isn't lost.
  useEffect(() => {
    return () => {
      flushPersist()
    }
  }, [flushPersist])

  return {
    session,
    setSession: setSessionSynced,
    currentScript,
    setCurrentScript: setCurrentScriptSynced,
    candles,
    cursorIndex,
    loading,
    error,
    loadSession,
    switchToScript,
    advanceCursor,
    flushPersist,
    settlePositions,
    addPositionLocal,
    updatePositionLocal,
    closePositionLocal,
    updateCapitalLocal,
    onSessionStarted,
    onSessionEnded,
  }
}
