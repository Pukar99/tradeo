import { useState, useCallback } from 'react'
import { btAddScript, btEndSession } from '../../api/backtest'

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtPct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' }

function PositionCard({ pos, currentCandle, onEditSLTP, onExit, onPartial }) {
  const ep          = parseFloat(pos.entry_price) || 0
  const ltp         = currentCandle?.close != null ? parseFloat(currentCandle.close) : ep
  const remQty      = pos.remaining_quantity ?? pos.quantity
  const unrealized  = (ltp - ep) * remQty
  const unrealizedPct = ep > 0 ? ((ltp - ep) / ep) * 100 : 0
  const settled     = pos.settled
  const nearSL      = pos.sl && ltp > 0 && Math.abs(ltp - parseFloat(pos.sl)) / ltp < 0.03

  return (
    <div className={`rounded-lg border p-2 text-[10px] ${nearSL ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-[11px] dark:text-white">{pos.symbol}</span>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${settled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
          {settled ? '✓ Settled' : '⏳ Settling'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-600 dark:text-gray-400 mb-1">
        <span>Qty</span>       <span className="text-right font-medium dark:text-gray-300">{remQty} kittā</span>
        <span>Entry</span>     <span className="text-right font-medium dark:text-gray-300">Rs.{fmt(ep)}</span>
        <span>LTP</span>       <span className="text-right font-medium dark:text-gray-300">Rs.{fmt(ltp)}</span>
        <span>SL</span>        <span className="text-right font-medium text-red-500">{pos.sl ? `Rs.${fmt(parseFloat(pos.sl))}` : <span className="text-gray-400">—</span>}</span>
        <span>TP</span>        <span className="text-right font-medium text-green-600">{pos.tp ? `Rs.${fmt(parseFloat(pos.tp))}` : <span className="text-gray-400">—</span>}</span>
      </div>

      <div className={`font-bold text-[11px] ${unrealized >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {unrealized >= 0 ? '+' : ''}Rs.{fmt(unrealized)}{' '}
        <span className="text-[9px] font-semibold">({fmtPct(unrealizedPct)})</span>
      </div>

      {!settled && (
        <div className="text-[9px] text-orange-500 dark:text-orange-400 mt-0.5">
          Settles {pos.settlement_date?.slice(0, 10)}
        </div>
      )}

      {nearSL && (
        <div className="text-[9px] text-red-600 font-semibold animate-pulse mt-0.5">⚠ Near SL</div>
      )}

      <div className="flex gap-1 mt-1.5">
        <button
          onClick={() => onEditSLTP(pos)}
          className="flex-1 py-0.5 text-[9px] font-semibold rounded border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-gray-300"
        >
          SL/TP
        </button>
        {settled && (
          <>
            <button
              onClick={() => onPartial(pos)}
              className="flex-1 py-0.5 text-[9px] font-semibold rounded border border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 dark:text-gray-300"
            >
              Partial
            </button>
            <button
              onClick={() => onExit(pos)}
              className="flex-1 py-0.5 text-[9px] font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Exit
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BacktestActivePanel({
  session, currentScript, currentCandle, totalCandles,
  onScriptSwitch, onBuy, onEditSLTP, onExit, onPartial, onEndSession,
}) {
  const [addingScript, setAddingScript] = useState(false)
  const [newSymbol, setNewSymbol]       = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [addErr, setAddErr]             = useState('')
  const [addLoading, setAddLoading]     = useState(false)
  const [confirmEnd, setConfirmEnd]     = useState(false)

  const allPositions  = currentScript?.positions || []
  const openPositions = allPositions.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL')

  // Rule 1: parseFloat all Supabase numeric strings
  const initCap     = parseFloat(session.initial_capital)   || 0
  const availCap    = parseFloat(session.available_capital) || 0
  const inCapital   = initCap - availCap

  const unrealizedTotal = openPositions.reduce((s, p) => {
    const ep  = parseFloat(p.entry_price) || 0
    const ltp = currentCandle?.close != null ? parseFloat(currentCandle.close) : ep
    return s + (ltp - ep) * (p.remaining_quantity ?? p.quantity)
  }, 0)

  const totalEquity     = availCap + unrealizedTotal
  const totalEquityPct  = initCap > 0 ? ((totalEquity - initCap) / initCap) * 100 : 0

  const progress = currentScript && totalCandles > 0
    ? Math.round((currentScript.cursor_index / totalCandles) * 100)
    : 0

  const handleAddScript = useCallback(async () => {
    setAddErr('')
    if (!newSymbol.trim()) return setAddErr('Enter a symbol')
    if (!newStartDate)     return setAddErr('Select a start date')
    setAddLoading(true)
    try {
      const res = await btAddScript(session.id, { symbol: newSymbol.toUpperCase(), start_date: newStartDate })
      onScriptSwitch(res.data)
      setAddingScript(false)
      setNewSymbol('')
      setNewStartDate('')
    } catch (err) {
      setAddErr(err.response?.data?.message || 'Failed to add script')
    } finally {
      setAddLoading(false)
    }
  }, [session.id, newSymbol, newStartDate, onScriptSwitch])

  const handleEndSession = useCallback(async () => {
    try {
      await btEndSession(session.id)
      onEndSession()
    } catch {}
  }, [session.id, onEndSession])

  return (
    <div className="flex flex-col h-full overflow-hidden text-[10px]">

      {/* ── Top: Script tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0 flex-wrap">
        {session.scripts?.map(sc => {
          const hasPos  = sc.positions?.some(p => p.status === 'OPEN' || p.status === 'PARTIAL')
          const isActive = currentScript?.id === sc.id
          return (
            <button
              key={sc.id}
              onClick={() => onScriptSwitch(sc)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {sc.symbol}
              {hasPos && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-200' : 'bg-blue-500'}`} />}
            </button>
          )
        })}
        <button
          onClick={() => setAddingScript(v => !v)}
          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          + Add
        </button>
      </div>

      {/* ── Add script mini-form ──────────────────────────────────────────── */}
      {addingScript && (
        <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/10 shrink-0">
          <input
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol (e.g. NLIC)"
            autoComplete="off"
            className="w-full px-2 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none mb-1"
          />
          <input
            type="date"
            value={newStartDate}
            onChange={e => setNewStartDate(e.target.value)}
            className="w-full px-2 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none mb-1"
          />
          {addErr && <div className="text-red-500 text-[9px] mb-1">{addErr}</div>}
          <div className="flex gap-1">
            <button onClick={handleAddScript} disabled={addLoading}
              className="flex-1 py-1 text-[9px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {addLoading ? 'Adding…' : 'Add Script'}
            </button>
            <button onClick={() => setAddingScript(false)}
              className="flex-1 py-1 text-[9px] font-bold border border-gray-200 dark:border-gray-700 rounded text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">

        {/* Progress */}
        {currentScript && (
          <div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400 mb-0.5">
              <span className="font-bold dark:text-white">{currentScript.symbol}</span>
              <span className="tabular-nums">{currentScript.current_date_val?.slice(0, 10)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <div className="text-[8px] text-gray-400 text-right mt-0.5">{progress}%</div>
          </div>
        )}

        {/* Total Equity Banner */}
        <div className={`rounded-lg px-2.5 py-2 border ${totalEquityPct >= 0 ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10'}`}>
          <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Session Equity</div>
          <div className={`text-[14px] font-bold ${totalEquityPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            Rs.{fmt(totalEquity)}
          </div>
          <div className={`text-[9px] font-semibold ${totalEquityPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalEquityPct >= 0 ? '+' : ''}{totalEquityPct.toFixed(2)}% vs initial Rs.{fmt(initCap)}
          </div>
        </div>

        {/* Capital breakdown */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 bg-gray-50 dark:bg-gray-900">
          <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">Capital</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-600 dark:text-gray-400">
            <span>Available</span>
            <span className="text-right font-semibold text-blue-600">Rs.{fmt(availCap)}</span>
            <span>In Trade</span>
            <span className="text-right font-semibold dark:text-gray-300">Rs.{fmt(inCapital)}</span>
            <span>Unrealized</span>
            <span className={`text-right font-semibold ${unrealizedTotal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {unrealizedTotal >= 0 ? '+' : ''}Rs.{fmt(unrealizedTotal)}
            </span>
          </div>
        </div>

        {/* Open positions */}
        <div>
          <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Open Positions {openPositions.length > 0 && `(${openPositions.length})`}
          </div>
          {openPositions.length === 0
            ? <div className="text-[10px] text-gray-400 py-2 text-center italic">No open positions</div>
            : openPositions.map(pos => (
              <div key={pos.id} className="mb-1.5">
                <PositionCard
                  pos={pos}
                  currentCandle={currentCandle}
                  onEditSLTP={onEditSLTP}
                  onExit={onExit}
                  onPartial={onPartial}
                />
              </div>
            ))
          }
        </div>

        {/* Session meta */}
        <div className="text-[8px] text-gray-400 text-center pt-1 border-t border-gray-100 dark:border-gray-800">
          SL Mode: <span className={`font-bold ${session.sl_mode === 'AUTO' ? 'text-orange-500' : 'text-blue-500'}`}>{session.sl_mode}</span>
          {' · '}{session.strategy_name}
        </div>

        {/* End session */}
        {!confirmEnd ? (
          <button
            onClick={() => setConfirmEnd(true)}
            className="w-full py-1 text-[9px] font-semibold text-red-500 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            End Session
          </button>
        ) : (
          <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-2">
            <div className="text-[9px] text-red-600 dark:text-red-400 mb-1.5 text-center">
              Open positions will be marked ABANDONED. Are you sure?
            </div>
            <div className="flex gap-1">
              <button onClick={handleEndSession}
                className="flex-1 py-1 text-[9px] font-bold bg-red-600 text-white rounded hover:bg-red-700">
                End & Report
              </button>
              <button onClick={() => setConfirmEnd(false)}
                className="flex-1 py-1 text-[9px] font-bold border border-gray-200 dark:border-gray-700 rounded text-gray-500">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pinned BUY button ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-2 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={onBuy}
          className="w-full py-2 text-[11px] font-bold rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-colors shadow-sm"
        >
          BUY
        </button>
      </div>
    </div>
  )
}
