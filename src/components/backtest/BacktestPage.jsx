import { useState, useCallback, useEffect, useRef } from 'react'
import { useBacktestSession } from '../../hooks/useBacktestSession'
import { useBacktestEngine }  from '../../hooks/useBacktestEngine'
import BacktestSetupPanel     from './BacktestSetupPanel'
import BacktestActivePanel    from './BacktestActivePanel'
import BacktestChart          from './BacktestChart'
import BacktestControls       from './BacktestControls'
import BacktestReport         from './BacktestReport'
import BuyOrderModal          from './BuyOrderModal'
import SLTPUpdateModal        from './SLTPUpdateModal'
import SLValidationPrompt     from './SLValidationPrompt'
import PartialExitModal       from './PartialExitModal'
import { btExitOrder }        from '../../api/backtest'

export default function BacktestPage() {
  const {
    session, currentScript, candles, cursorIndex, loading, error,
    loadSession, switchToScript, advanceCursor, settlePositions,
    addPositionLocal, updatePositionLocal, closePositionLocal, updateCapitalLocal,
    onSessionStarted, onSessionEnded,
  } = useBacktestSession()

  // Modals
  const [showBuy,     setShowBuy]     = useState(false)
  const [showSLTP,    setShowSLTP]    = useState(null)
  const [showPartial, setShowPartial] = useState(null)
  const [prompt,      setPrompt]      = useState(null)
  const [showReport,  setShowReport]  = useState(false)
  const [speed,       setSpeedState]  = useState('1')
  // isPlaying is derived from a ref in the engine — we use a React state copy for UI
  const [isPlaying,   setIsPlaying]   = useState(false)

  // Load session on mount (restore if active)
  useEffect(() => { loadSession() }, [loadSession])

  // Keyboard shortcuts: Space = play/pause, → = step forward, ← = step back
  useEffect(() => {
    if (!session) return
    const h = e => {
      // Don't fire if user is typing in an input/textarea
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

  const currentCandle = candles[cursorIndex] || null

  // ── SL/TP Breach handlers ─────────────────────────────────────────────────────
  const handleSLBreach = useCallback((data) => {
    setIsPlaying(false)
    setPrompt({ ...data, type: data.preSettlement ? 'PRE_SETTLEMENT_SL' : 'MANUAL_SL' })
  }, [])

  const handleTPHit = useCallback((data) => {
    setIsPlaying(false)
    setPrompt({ ...data, type: 'PRE_SETTLEMENT_TP' })
  }, [])

  const handleDataEnd = useCallback(() => {
    setIsPlaying(false)
    setShowReport(true)
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
    onSLBreach:  handleSLBreach,
    onTPHit:     handleTPHit,
    onDataEnd:   handleDataEnd,
  })

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
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

  const handleSpeedChange = useCallback((s) => {
    setSpeedState(s)
    engine.setSpeed(s)
  }, [engine])

  // ── Prompt dismiss/action ─────────────────────────────────────────────────────
  const handlePromptAction = useCallback(async (opt) => {
    await opt.action()
    setPrompt(null)
  }, [])

  // ── Full exit (from panel button) ─────────────────────────────────────────────
  const [exitError, setExitError] = useState('')

  const handleFullExit = useCallback(async (order) => {
    if (!session || !currentCandle) return
    setExitError('')
    try {
      const res = await btExitOrder(session.id, order.id, {
        exit_date:  currentCandle.date,
        exit_price: currentCandle.close,
        reason:     'MANUAL',
      })
      closePositionLocal(order.id, res.data)
      updateCapitalLocal(res.data.available_capital_after)
    } catch (err) {
      setExitError(err.response?.data?.message || 'Failed to exit position')
    }
  }, [session, currentCandle, closePositionLocal, updateCapitalLocal])

  // ── Script switch ─────────────────────────────────────────────────────────────
  const handleScriptSwitch = useCallback((script) => {
    handlePause()
    switchToScript(session, script)
  }, [handlePause, session, switchToScript])

  // ── End session ───────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(() => {
    handlePause()
    setShowReport(true)
  }, [handlePause])

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      Loading session…
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-red-500">{error}</div>
  )

  if (showReport && session) return (
    <BacktestReport
      sessionId={session.id}
      onClose={() => { setShowReport(false); onSessionEnded() }}
    />
  )

  // ── Main layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* LEFT PANEL */}
      <div className="w-[260px] min-w-[240px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden">
        {!session ? (
          <BacktestSetupPanel onSessionStarted={(sess, opts) => {
            onSessionStarted(sess)
            if (opts?.speed)   { setSpeedState(opts.speed); engine.setSpeed(opts.speed) }
            if (opts?.runMode === 'PLAY') { handlePlay() }
          }} />
        ) : (
          <BacktestActivePanel
            session={session}
            currentScript={currentScript}
            currentCandle={currentCandle}
            totalCandles={candles.length}
            onScriptSwitch={handleScriptSwitch}
            onBuy={() => setShowBuy(true)}
            onEditSLTP={(order) => setShowSLTP(order)}
            onExit={handleFullExit}
            onPartial={(order) => setShowPartial(order)}
            onEndSession={handleEndSession}
          />
        )}
      </div>

      {/* CENTER: Chart + Controls */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }} className="bg-white dark:bg-gray-950">
          {session && candles.length > 0 ? (
            <div style={{ position: 'absolute', inset: 0 }}>
              <BacktestChart
                candles={candles}
                cursorIndex={cursorIndex}
                positions={currentScript?.positions || []}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[12px] text-gray-400">
              {session ? 'Loading chart data…' : 'Configure and start a backtest to begin'}
            </div>
          )}
        </div>

        {session && (
          <BacktestControls
            playing={isPlaying}
            speed={speed}
            cursorIndex={cursorIndex}
            totalCandles={candles.length}
            currentDate={currentCandle?.date || currentScript?.current_date_val?.slice(0, 10)}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={handleStep}
            onStepBack={handleStepBack}
            onSpeedChange={handleSpeedChange}
          />
        )}
      </div>

      {/* Exit error toast */}
      {exitError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white text-[11px] font-semibold px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>{exitError}</span>
          <button onClick={() => setExitError('')} className="text-white/70 hover:text-white font-bold">×</button>
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
        <PartialExitModal
          session={session}
          order={showPartial}
          candle={currentCandle}
          onClose={() => setShowPartial(null)}
          onExited={(data) => {
            updatePositionLocal(showPartial.id, {
              status: data.status,
              remaining_quantity: data.remaining_quantity,
              partial_exits: data.partial_exits,
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
            options: prompt.options.map(opt => ({
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
