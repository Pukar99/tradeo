// === BacktestPage.jsx — backtest page root: session orchestration, modals, chart, keyboard shortcuts ===

import { useState, useCallback, useEffect, useRef } from 'react'
import { useBacktestSession } from '../../hooks/useBacktestSession'
import { useBacktestEngine } from '../../hooks/useBacktestEngine'
import BacktestHome from './BacktestHome'
import BacktestActivePanel from './BacktestActivePanel'
import BacktestChart from './BacktestChart'
import BacktestControls from './BacktestControls'
import BacktestReport from './BacktestReport'
import BuyOrderModal from './BuyOrderModal'
import SLTPUpdateModal from './SLTPUpdateModal'
import SLValidationPrompt from './SLValidationPrompt'
import BacktestPartialExitModal from './BacktestPartialExitModal'
import { btEndSession, btExitOrder } from '../../api/backtest'

export default function BacktestPage() {
  const {
    session,
    currentScript,
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
  } = useBacktestSession()

  // Modals
  const [showBuy, setShowBuy] = useState(false)
  const [showSLTP, setShowSLTP] = useState(null)
  const [showPartial, setShowPartial] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [speed, setSpeedState] = useState('1')
  // isPlaying is derived from a ref in the engine — we use a React state copy for UI
  const [isPlaying, setIsPlaying] = useState(false)
  // Exit/action error toast — set by manual exit and by engine auto SL/TP failures
  const [exitError, setExitError] = useState('')
  const endingRef = useRef(false)

  // Load session on mount (restore if active)
  useEffect(() => {
    loadSession()
  }, [loadSession])

  const currentCandle = candles[cursorIndex] || null

  // Step-back is a chart-view rewind only and is disabled once any position exists
  // (settlements/SL/TP/exits are irreversible — see useBacktestEngine stepBack note).
  const hasAnyPosition = (currentScript?.positions || []).length > 0
  const stepBackDisabled = isPlaying || cursorIndex <= 0 || hasAnyPosition
  const stepBackReason = hasAnyPosition
    ? 'Step back is unavailable after a position is opened (settlements can’t be undone)'
    : 'Step back (ArrowLeft)'

  // ── SL/TP Breach handlers ─────────────────────────────────────────────────────
  const handleSLBreach = useCallback((data) => {
    setIsPlaying(false)
    setPrompt({ ...data, type: data.preSettlement ? 'PRE_SETTLEMENT_SL' : 'MANUAL_SL' })
  }, [])

  const handleTPHit = useCallback((data) => {
    setIsPlaying(false)
    setPrompt({ ...data, type: 'PRE_SETTLEMENT_TP' })
  }, [])

  const handleDataEnd = useCallback(async () => {
    setIsPlaying(false)
    if (!session || endingRef.current) return
    endingRef.current = true
    try {
      await flushPersist()
      await btEndSession(session.id)
      setShowReport(true)
    } catch (err) {
      setExitError(err.response?.data?.message || 'Failed to complete the session. Please retry.')
    } finally {
      endingRef.current = false
    }
  }, [session, flushPersist])

  // Surface engine-side action failures (auto SL/TP exits) and stop the UI play state
  // so the engine's internal pause is reflected in the controls.
  const handleActionError = useCallback((msg) => {
    setIsPlaying(false)
    setExitError(msg)
  }, [])

  // ── Engine ────────────────────────────────────────────────────────────────────
  // The engine uses internal refs — its play/pause/step callbacks are stable
  const engine = useBacktestEngine({
    session,
    currentScript,
    candles,
    cursorIndex,
    advanceCursor,
    settlePositions,
    closePositionLocal,
    onSLBreach: handleSLBreach,
    onTPHit: handleTPHit,
    onActionError: handleActionError,
    onDataEnd: handleDataEnd,
  })

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    engine.play()
  }, [engine])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    engine.pause()
    flushPersist() // persist the exact paused cursor immediately
  }, [engine, flushPersist])

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

  // ── Prompt dismiss/action ─────────────────────────────────────────────────────
  const handlePromptAction = useCallback(async (opt) => {
    try {
      await opt.action()
      setPrompt(null)
    } catch (err) {
      setExitError(err.response?.data?.message || 'The selected action failed. Please try again.')
    }
  }, [])

  // ── Full exit (from panel button) ─────────────────────────────────────────────
  // Auto-dismiss exit error toast after 4 seconds
  useEffect(() => {
    if (!exitError) return
    const t = setTimeout(() => setExitError(''), 4000)
    return () => clearTimeout(t)
  }, [exitError])
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  const handleFullExit = useCallback(
    async (order) => {
      if (!session || !currentCandle) return
      setExitError('')
      try {
        const res = await btExitOrder(session.id, order.id, {
          exit_date: currentCandle.date,
          exit_price: currentCandle.close,
          reason: 'MANUAL',
        })
        closePositionLocal(order.id, res.data)
        updateCapitalLocal(res.data.available_capital_after)
      } catch (err) {
        setExitError(err.response?.data?.message || 'Failed to exit position')
      }
    },
    [session, currentCandle, closePositionLocal, updateCapitalLocal]
  )

  // ── Script switch ─────────────────────────────────────────────────────────────
  const handleScriptSwitch = useCallback(
    (script) => {
      handlePause()
      switchToScript(session, script)
    },
    [handlePause, session, switchToScript]
  )

  // ── End session ───────────────────────────────────────────────────────────────
  // Mirrors handleDataEnd: a manual end must COMPLETE the backend session (status→COMPLETED),
  // not just show the report — otherwise the session stays ACTIVE and loadSession() restores it.
  const handleEndSession = useCallback(async () => {
    handlePause()
    if (!session || endingRef.current) return
    endingRef.current = true
    try {
      await flushPersist()
      await btEndSession(session.id)
      setShowReport(true)
    } catch (err) {
      setExitError(err.response?.data?.message || 'Failed to complete the session. Please retry.')
    } finally {
      endingRef.current = false
    }
  }, [handlePause, session, flushPersist])

  // ── Keyboard shortcuts (must be after all handlers) ───────────────────────────
  useEffect(() => {
    if (!session) return
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
  }, [session, isPlaying, handlePlay, handlePause, handleStep, handleStepBack])

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
        Loading session…
      </div>
    )

  if (error)
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-red-500">
        {error}
      </div>
    )

  if (showReport && session)
    return (
      <BacktestReport
        sessionId={session.id}
        onClose={() => {
          setShowReport(false)
          onSessionEnded()
        }}
      />
    )

  const sidePanelSetupProps = {
    onSessionStarted: (sess, opts) => {
      onSessionStarted(sess)
      if (opts?.speed) {
        setSpeedState(opts.speed)
        engine.setSpeed(opts.speed)
      }
      if (opts?.runMode === 'PLAY') {
        handlePlay()
      }
      setMobilePanelOpen(false)
    },
  }

  // ── No active session → redesigned home (lifetime KPIs + history + setup) ───────
  if (!session) return <BacktestHome onSessionStarted={sidePanelSetupProps.onSessionStarted} />

  const sidePanelActiveProps = {
    session,
    currentScript,
    currentCandle,
    totalCandles: candles.length,
    onScriptSwitch: handleScriptSwitch,
    onBuy: () => {
      setShowBuy(true)
      setMobilePanelOpen(false)
    },
    onEditSLTP: (order) => {
      setShowSLTP(order)
      setMobilePanelOpen(false)
    },
    onExit: handleFullExit,
    onPartial: (order) => {
      setShowPartial(order)
      setMobilePanelOpen(false)
    },
    onEndSession: handleEndSession,
  }

  // ── Main layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* LEFT PANEL — desktop only (session is always active past this point) */}
      <div className="hidden md:flex w-[260px] min-w-[240px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col shrink-0 overflow-hidden">
        <BacktestActivePanel {...sidePanelActiveProps} />
      </div>

      {/* CENTER: Chart + Controls */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Mobile top bar */}
        <div
          className="md:hidden shrink-0 flex items-center justify-between px-3 py-2
                        border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
            {session.strategy_name}
          </span>
          <button
            onClick={() => setMobilePanelOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold
                       bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
                       hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Positions
            <svg
              className="w-3 h-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <polyline points="6 4 10 8 6 12" />
            </svg>
          </button>
        </div>
        <div
          style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}
          className="bg-white dark:bg-gray-950"
        >
          {candles.length > 0 ? (
            <div style={{ position: 'absolute', inset: 0 }}>
              <BacktestChart
                candles={candles}
                cursorIndex={cursorIndex}
                positions={currentScript?.positions || []}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[12px] text-gray-400">
              Loading chart data…
            </div>
          )}
        </div>

        <BacktestControls
          playing={isPlaying}
          speed={speed}
          cursorIndex={cursorIndex}
          totalCandles={candles.length}
          currentDate={currentCandle?.date || currentScript?.current_date_val?.slice(0, 10)}
          stepBackDisabled={stepBackDisabled}
          stepBackReason={stepBackReason}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={handleStep}
          onStepBack={handleStepBack}
          onSpeedChange={handleSpeedChange}
        />
      </div>

      {/* Mobile left panel sheet */}
      {mobilePanelOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={() => setMobilePanelOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800"
            style={{ height: '72vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                Active Session
              </span>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[12px] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <BacktestActivePanel {...sidePanelActiveProps} />
            </div>
          </div>
        </>
      )}

      {/* Exit error toast */}
      {exitError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white text-[11px] font-semibold px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>{exitError}</span>
          <button
            onClick={() => setExitError('')}
            className="text-white/70 hover:text-white font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* MODALS */}
      {showBuy && session && currentScript && currentCandle && (
        <BuyOrderModal
          session={session}
          script={currentScript}
          candle={currentCandle}
          onClose={() => setShowBuy(false)}
          onOrderPlaced={(order) => {
            addPositionLocal(order)
            updateCapitalLocal(order.available_capital_after)
          }}
        />
      )}

      {showSLTP && session && (
        <SLTPUpdateModal
          session={session}
          order={showSLTP}
          onClose={() => setShowSLTP(null)}
          onUpdated={(updated) => {
            updatePositionLocal(updated.id, { sl: updated.sl, tp: updated.tp })
            setShowSLTP(null)
          }}
        />
      )}

      {showPartial && session && currentCandle && (
        <BacktestPartialExitModal
          session={session}
          order={showPartial}
          candle={currentCandle}
          onClose={() => setShowPartial(null)}
          onExited={(data) => {
            updatePositionLocal(showPartial.id, {
              status: data.status,
              remaining_quantity: data.remaining_quantity,
            })
            updateCapitalLocal(data.available_capital_after)
            setShowPartial(null)
          }}
        />
      )}

      {prompt && (
        <SLValidationPrompt
          prompt={{
            ...prompt,
            options: prompt.options.map((opt) => ({
              ...opt,
              action: () => handlePromptAction(opt),
            })),
          }}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  )
}
