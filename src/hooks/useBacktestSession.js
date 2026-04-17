import { useState, useCallback, useRef } from 'react'
import { btGetSession, btGetOHLCV, btUpdateSession, btSettleOrder } from '../api/backtest'

/**
 * Manages the active backtest session state.
 * Handles: session load/restore, OHLCV fetch per script, cursor persistence,
 * and local state mutations after orders.
 */
export function useBacktestSession() {
  const [session, setSession]               = useState(null)
  const [currentScript, setCurrentScript]   = useState(null)
  const [candles, setCandles]               = useState([])
  const [cursorIndex, setCursorIndex]       = useState(0)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')

  // Refs to break circular/stale closure issues
  const sessionRef       = useRef(null)
  const currentScriptRef = useRef(null)

  // Keep refs in sync with state
  const setSessionSynced = useCallback((val) => {
    const resolved = typeof val === 'function' ? val(sessionRef.current) : val
    sessionRef.current = resolved
    setSession(resolved)
  }, [])

  const setCurrentScriptSynced = useCallback((val) => {
    const resolved = typeof val === 'function' ? val(currentScriptRef.current) : val
    currentScriptRef.current = resolved
    setCurrentScript(resolved)
  }, [])

  // ── Local position state mutations ────────────────────────────────────────────
  const updatePositionLocal = useCallback((orderId, changes) => {
    setCurrentScriptSynced(prev => {
      if (!prev) return prev
      return {
        ...prev,
        positions: prev.positions.map(p => p.id === orderId ? { ...p, ...changes } : p),
      }
    })
  }, [setCurrentScriptSynced])

  const addPositionLocal = useCallback((order) => {
    setCurrentScriptSynced(prev => {
      if (!prev) return prev
      return { ...prev, positions: [...(prev.positions || []), order] }
    })
    setSessionSynced(prev => ({
      ...prev,
      available_capital: order.available_capital_after ?? prev.available_capital,
    }))
  }, [setCurrentScriptSynced, setSessionSynced])

  const closePositionLocal = useCallback((orderId, exitData) => {
    setCurrentScriptSynced(prev => {
      if (!prev) return prev
      return {
        ...prev,
        positions: prev.positions.map(p =>
          p.id === orderId ? { ...p, status: 'CLOSED', ...exitData } : p
        ),
      }
    })
    setSessionSynced(prev => ({
      ...prev,
      available_capital: exitData.available_capital_after ?? prev.available_capital,
    }))
  }, [setCurrentScriptSynced, setSessionSynced])

  const updateCapitalLocal = useCallback((newCapital) => {
    setSessionSynced(prev => ({ ...prev, available_capital: newCapital }))
  }, [setSessionSynced])

  // ── Switch to a different script ──────────────────────────────────────────────
  // Uses ref for session to avoid stale closure — safe to call from loadSession
  const switchToScript = useCallback(async (sess, script) => {
    const sessToUse = sess || sessionRef.current
    if (!sessToUse || !script) return

    setCurrentScriptSynced(script)
    setCursorIndex(script.cursor_index || 0)

    try {
      const today = new Date().toISOString().slice(0, 10)
      const res   = await btGetOHLCV(script.symbol, script.start_date, today)
      const allCandles = res.data.candles || []
      setCandles(allCandles)

      // Attach total_candles to local script object
      setCurrentScriptSynced(prev => ({ ...prev, total_candles: allCandles.length }))
    } catch {
      setCandles([])
    }

    // Update session's active_script in backend (fire-and-forget)
    if (sessToUse.active_script !== script.symbol) {
      btUpdateSession(sessToUse.id, { active_script: script.symbol }).catch(() => {})
    }
  }, [setCurrentScriptSynced])

  // ── Load / restore session ────────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await btGetSession()
      const sess = res.data
      setSessionSynced(sess)

      const activeScript = sess.scripts?.find(s => s.symbol === sess.active_script) || sess.scripts?.[0]
      if (activeScript) {
        await switchToScript(sess, activeScript)
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to load session')
      }
    } finally {
      setLoading(false)
    }
  }, [setSessionSynced, switchToScript])

  // ── Called by engine each tick to advance cursor ──────────────────────────────
  const advanceCursor = useCallback((newIndex, newDate) => {
    setCursorIndex(newIndex)
    setCurrentScriptSynced(prev => {
      if (!prev) return prev
      return { ...prev, cursor_index: newIndex, current_date_val: newDate }
    })

    // Persist to backend (fire-and-forget)
    const sess   = sessionRef.current
    const script = currentScriptRef.current
    if (sess && script) {
      btUpdateSession(sess.id, {
        script_id:    script.id,
        cursor_index: newIndex,
        current_date_val: newDate,
      }).catch(() => {})
    }
  }, [setCurrentScriptSynced])

  // ── Mark positions as settled ─────────────────────────────────────────────────
  const settlePositions = useCallback(async (currentDate) => {
    const script = currentScriptRef.current
    const sess   = sessionRef.current
    if (!script?.positions || !sess) return

    const toSettle = script.positions.filter(
      p => !p.settled && (p.status === 'OPEN' || p.status === 'PARTIAL')
         && p.settlement_date?.slice(0, 10) <= currentDate
    )

    for (const pos of toSettle) {
      try {
        await btSettleOrder(sess.id, pos.id)
        updatePositionLocal(pos.id, { settled: true })
      } catch {}
    }
  }, [updatePositionLocal])

  // ── Session started (from setup panel) ───────────────────────────────────────
  const onSessionStarted = useCallback(async (newSession) => {
    setSessionSynced(newSession)
    const firstScript = newSession.scripts?.[0]
    if (firstScript) {
      await switchToScript(newSession, firstScript)
    }
  }, [setSessionSynced, switchToScript])

  // ── Session ended ─────────────────────────────────────────────────────────────
  const onSessionEnded = useCallback(() => {
    setSessionSynced(null)
    setCurrentScriptSynced(null)
    setCandles([])
    setCursorIndex(0)
  }, [setSessionSynced, setCurrentScriptSynced])

  return {
    session, setSession: setSessionSynced,
    currentScript, setCurrentScript: setCurrentScriptSynced,
    candles,
    cursorIndex,
    loading,
    error,
    loadSession,
    switchToScript,
    advanceCursor,
    settlePositions,
    addPositionLocal,
    updatePositionLocal,
    closePositionLocal,
    updateCapitalLocal,
    onSessionStarted,
    onSessionEnded,
  }
}
