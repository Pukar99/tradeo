// === PositionRow.jsx — expandable position card: stats, SL/TP/RR, action history expand, context menu ===

import { useState, useEffect, useCallback } from 'react'
import { getTradeHistory } from '../../api'
import { useContextMenu } from '../ContextMenu'
import ActionHistory from './ActionHistory'
import EditActionModal from './EditActionModal'
import { fmt } from '../../utils/format'

const DIRECTION_CFG = {
  LONG:  { label: '↑ Long',  bg: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' },
  SHORT: { label: '↓ Short', bg: 'bg-red-500',     pill: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20' },
}

const STATUS_CFG = {
  OPEN:    { label: 'Open',    dot: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' },
  PARTIAL: { label: 'Partial', dot: 'bg-amber-500',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' },
  CLOSED:  { label: 'Closed',  dot: 'bg-gray-400',   pill: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-600/20' },
}

export default function PositionRow({ position, ltp, onAdd, onPartialExit, onClose, onDelete, onDeleteAction, onRefresh, refreshTick }) {
  const [expanded,   setExpanded]   = useState(false)
  const [actions,    setActions]    = useState(null)
  const [fetched,    setFetched]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const wacc      = parseFloat(position.wacc) || 0
  const totalQty  = parseFloat(position.total_qty) || 0
  const ltpNum    = ltp ? parseFloat(ltp) : null
  const isClosed  = position.status === 'CLOSED'
  const direction = position.direction?.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT'
  const dirCfg    = DIRECTION_CFG[direction]
  const statusCfg = STATUS_CFG[position.status] || STATUS_CFG.CLOSED

  const unrealPnl = ltpNum != null && !isClosed
    ? (direction === 'LONG' ? (ltpNum - wacc) * totalQty : (wacc - ltpNum) * totalQty)
    : null

  const pnlValue   = isClosed ? parseFloat(position.total_realized_pnl) : unrealPnl
  const pnlLabel   = isClosed ? 'P&L' : 'Unreal'
  const hasPnl     = pnlValue != null && !isNaN(pnlValue)
  const pnlPos     = hasPnl && pnlValue >= 0

  // SL/TP distance from WACC
  const slPct = position.sl && wacc > 0
    ? Math.abs((parseFloat(position.sl) - wacc) / wacc * 100).toFixed(1)
    : null
  const tpPct = position.tp && wacc > 0
    ? Math.abs((parseFloat(position.tp) - wacc) / wacc * 100).toFixed(1)
    : null

  // R:R
  const rr = position.sl && position.tp && wacc > 0
    ? (Math.abs(parseFloat(position.tp) - wacc) / Math.abs(parseFloat(position.sl) - wacc)).toFixed(1)
    : null

  const fetchHistory = useCallback(async () => {
    if (fetched) return
    setLoading(true)
    try {
      const res = await getTradeHistory(position.trade_id)
      setActions(res.data)
      setFetched(true)
    } catch {
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [position.trade_id, fetched])

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTradeHistory(position.trade_id)
      setActions(res.data)
      setFetched(true)
    } catch {
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [position.trade_id])

  useEffect(() => {
    if (expanded && !fetched) fetchHistory()
  }, [expanded, fetchHistory, fetched])

  // When parent triggers a refresh (trade saved/closed/exited), clear the
  // cached actions so the next expand (or immediate if already open) re-fetches.
  useEffect(() => {
    if (refreshTick === undefined) return
    setActions(null)
    setFetched(false)
    if (expanded) refreshHistory()
  }, [refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const menuItems = isClosed
    ? [{ label: 'Delete Trade', icon: '🗑', action: () => onDelete(position) }]
    : [
        { label: 'Add to Position', icon: '＋', action: () => onAdd(position) },
        { label: 'Partial Exit',    icon: '↗', action: () => onPartialExit(position) },
        { label: 'Close Position',  icon: '✓', action: () => onClose(position) },
        { separator: true },
        { label: 'Delete Trade',    icon: '🗑', action: () => onDelete(position) },
      ]

  const handleEditSaved = useCallback((updatedAction) => {
    setActions(prev => prev ? prev.map(a => a.id === updatedAction.id ? updatedAction : a) : prev)
    setEditTarget(null)
    onRefresh()
  }, [onRefresh])

  return (
    <>
      <ContextMenuPortal />
      {editTarget && (
        <EditActionModal
          action={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}

      <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        expanded
          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg shadow-black/5 dark:shadow-black/30'
          : 'border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/80 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20'
      }`}>

        {/* ── direction accent bar ── */}
        <div className={`h-0.5 w-full ${dirCfg.bg} opacity-60`} />

        {/* ── main card row ── */}
        <div
          className="flex items-center gap-4 px-4 py-3.5 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
          onContextMenu={onContextMenu(menuItems)}
        >
          {/* chevron */}
          <span className={`text-gray-300 dark:text-gray-600 transition-transform duration-200 text-[10px] shrink-0 ${expanded ? 'rotate-90' : ''}`}>▶</span>

          {/* symbol block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-[14px] text-gray-900 dark:text-gray-50 tracking-wide">{position.symbol}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${dirCfg.pill}`}>
                {dirCfg.label}
              </span>
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusCfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${position.status !== 'CLOSED' ? 'animate-pulse' : ''}`} />
                {statusCfg.label}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
              {position.opened_at?.slice(0, 10)}
            </div>
          </div>

          {/* mobile stats + P&L — shown only on xs/sm when full stats bar is hidden */}
          <div className="sm:hidden flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">Qty</div>
              <div className="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300">{totalQty}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">WACC</div>
              <div className="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300">Rs.{fmt(wacc)}</div>
            </div>
            {hasPnl && (
              <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-right ${
                pnlPos ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'
              }`}>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">{pnlLabel}</div>
                <div className={`text-[11px] font-bold font-mono ${pnlPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {pnlPos ? '+' : ''}Rs.{fmt(pnlValue)}
                </div>
              </div>
            )}
          </div>

          {/* stats row — desktop */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <StatCell label="Qty"  value={totalQty} mono />
            <StatCell label="WACC" value={`Rs.${fmt(wacc)}`} mono />

            {ltpNum != null && !isClosed && (
              <StatCell label="LTP" value={`Rs.${fmt(ltpNum)}`} mono
                color={ltpNum >= wacc ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} />
            )}

            {/* SL / TP with % */}
            {position.sl && (
              <StatCell
                label="SL"
                value={`Rs.${fmt(position.sl)}`}
                sub={slPct ? `↓${slPct}%` : undefined}
                mono
                color="text-red-500 dark:text-red-400"
                subColor="text-red-400/60"
              />
            )}
            {position.tp && (
              <StatCell
                label={rr ? `TP · 1:${rr}` : 'TP'}
                value={`Rs.${fmt(position.tp)}`}
                sub={tpPct ? `↑${tpPct}%` : undefined}
                mono
                color="text-emerald-500 dark:text-emerald-400"
                subColor="text-emerald-400/60"
              />
            )}

            {/* P&L */}
            {hasPnl && (
              <div className={`px-2.5 py-1.5 rounded-xl text-right ${
                pnlPos
                  ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : 'bg-red-50 dark:bg-red-500/10'
              }`}>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500 mb-0.5">{pnlLabel}</div>
                <div className={`text-[12px] font-bold font-mono ${pnlPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {pnlPos ? '+' : ''}Rs.{fmt(pnlValue)}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── expanded action history ── */}
        {expanded && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            {loading && (
              <div className="flex items-center gap-2 px-6 py-4 text-xs text-gray-400 dark:text-gray-500">
                <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                Loading history…
              </div>
            )}
            {error && <div className="px-6 py-4 text-xs text-red-500">{error}</div>}
            {!loading && !error && actions !== null && (
              <ActionHistory
                actions={actions}
                direction={direction}
                onEdit={a => setEditTarget(a)}
                onDelete={a => onDeleteAction(a, refreshHistory)}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}


function StatCell({ label, value, mono, color, sub, subColor }) {
  return (
    <div className="text-right">
      <div className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-[12px] ${mono ? 'font-mono' : ''} ${color || 'text-gray-900 dark:text-gray-200'}`}>{value}</div>
      {sub && <div className={`text-[10px] font-mono ${subColor || 'text-gray-500 dark:text-gray-400'}`}>{sub}</div>}
    </div>
  )
}
