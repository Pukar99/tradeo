// === PositionRow.jsx — expandable position card: stats, SL/TP/RR, action history expand, action menu ===

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTradeHistory } from '../../utils/globalCache'
import { useContextMenu } from '../ContextMenu'
import ActionHistory from './ActionHistory'
import EditActionModal from './EditActionModal'
import { fmt } from '../../utils/format'
import { DIRECTION_CFG, STATUS_CFG, computePositionMetrics } from './tradeConstants'

export default function PositionRow({
  position,
  ltp,
  onAdd,
  onPartialExit,
  onClose,
  onDelete,
  onDeleteAction,
  onRefresh,
  refreshTick,
}) {
  const [expanded, setExpanded] = useState(false)
  const [actions, setActions] = useState(null)
  const fetchedRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const { wacc, totalQty, ltpNum, isClosed, direction, pnlValue, hasPnl, slPct, tpPct, rr } =
    computePositionMetrics(position, ltp)

  const dirCfg = DIRECTION_CFG[direction]
  const statusCfg = STATUS_CFG[position.status] || STATUS_CFG.CLOSED
  const pnlLabel = isClosed ? 'P&L' : 'Unreal'
  const pnlPos = hasPnl && pnlValue >= 0

  const loadHistory = useCallback(
    async (force = false) => {
      if (!force && fetchedRef.current) return
      setLoading(true)
      setError(null)
      try {
        const res = await getTradeHistory(position.trade_id)
        setActions(res.data)
        fetchedRef.current = true
      } catch {
        setError('Failed to load history')
      } finally {
        setLoading(false)
      }
    },
    [position.trade_id]
  )

  useEffect(() => {
    if (expanded) loadHistory()
  }, [expanded, loadHistory])

  // When parent triggers a refresh (trade saved/closed/exited), clear the
  // cached actions so the next expand (or immediate if already open) re-fetches.
  const isFirstTick = useRef(true)
  useEffect(() => {
    if (isFirstTick.current) {
      isFirstTick.current = false
      return
    }
    setActions(null)
    fetchedRef.current = false
    if (expanded) loadHistory(true)
  }, [refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const menuItems = isClosed
    ? [{ label: 'Delete Trade', icon: '🗑', danger: true, action: () => onDelete(position) }]
    : [
        { label: 'Add to Position', icon: '＋', action: () => onAdd(position) },
        { label: 'Partial Exit', icon: '↗', action: () => onPartialExit(position) },
        { label: 'Close Position', icon: '✓', action: () => onClose(position) },
        { separator: true },
        { label: 'Delete Trade', icon: '🗑', danger: true, action: () => onDelete(position) },
      ]

  const handleEditSaved = useCallback(
    (updatedAction) => {
      setActions((prev) =>
        prev ? prev.map((a) => (a.id === updatedAction.id ? updatedAction : a)) : prev
      )
      setEditTarget(null)
      onRefresh()
    },
    [onRefresh]
  )

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

      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          expanded
            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg shadow-black/5 dark:shadow-black/30'
            : 'border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/80 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20'
        }`}
      >
        {/* ── direction accent bar ── */}
        <div className={`h-0.5 w-full ${dirCfg.accent} opacity-60`} />

        {/* ── main card row ── */}
        <div
          className="flex items-center gap-4 px-4 py-3.5 cursor-pointer select-none"
          onClick={() => setExpanded((e) => !e)}
          onContextMenu={onContextMenu(menuItems)}
        >
          {/* chevron */}
          <span
            className={`text-gray-300 dark:text-gray-600 transition-transform duration-200 text-[10px] shrink-0 ${expanded ? 'rotate-90' : ''}`}
          >
            ▶
          </span>

          {/* symbol block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-[14px] text-gray-900 dark:text-gray-50 tracking-wide">
                {position.symbol}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${dirCfg.pill}`}>
                {dirCfg.label}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusCfg.pill}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${statusCfg.pulse ? 'animate-pulse' : ''}`}
                />
                {statusCfg.label}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
              {position.opened_at?.slice(0, 10)}
            </div>
          </div>

          {/* stats row — desktop */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <StatCell label="Qty" value={totalQty} mono />
            <StatCell label="WACC" value={`Rs.${fmt(wacc)}`} mono />

            {ltpNum != null && !isClosed && (
              <StatCell
                label="LTP"
                value={`Rs.${fmt(ltpNum)}`}
                mono
                color={
                  ltpNum >= wacc
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                }
              />
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
              <div
                className={`px-2.5 py-1.5 rounded-xl text-right ${
                  pnlPos ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500 mb-0.5">
                  {pnlLabel}
                </div>
                <div
                  className={`text-[12px] font-bold font-mono ${pnlPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {pnlPos ? '+' : ''}Rs.{fmt(pnlValue)}
                </div>
              </div>
            )}
          </div>

          {/* action menu — visible button so actions work without right-click (touch) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(menuItems)(e)
            }}
            aria-label={`Actions for ${position.symbol}`}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[14px] leading-none"
          >
            ⋯
          </button>
        </div>

        {/* ── mobile stat strip — second row, sm:hidden ── */}
        <div
          className="sm:hidden grid grid-cols-4 gap-2 px-4 pb-3 -mt-1 cursor-pointer select-none"
          onClick={() => setExpanded((e) => !e)}
          onContextMenu={onContextMenu(menuItems)}
        >
          <MobileStat label="Qty" value={totalQty} />
          <MobileStat label="WACC" value={`Rs.${fmt(wacc)}`} />
          <MobileStat
            label="LTP"
            value={ltpNum != null && !isClosed ? `Rs.${fmt(ltpNum)}` : '—'}
          />
          <MobileStat
            label={pnlLabel}
            value={hasPnl ? `${pnlPos ? '+' : ''}Rs.${fmt(pnlValue)}` : '—'}
            color={
              !hasPnl
                ? undefined
                : pnlPos
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
            }
          />
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
            {error && !loading && <div className="px-6 py-4 text-xs text-red-500">{error}</div>}
            {!loading && !error && actions !== null && (
              <ActionHistory
                actions={actions}
                onEdit={(a) => setEditTarget(a)}
                onDelete={(a) => onDeleteAction(a, () => loadHistory(true))}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}

function MobileStat({ label, value, color }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500 mb-0.5">
        {label}
      </div>
      <div
        className={`text-[11px] font-bold font-mono truncate ${color || 'text-gray-700 dark:text-gray-300'}`}
      >
        {value}
      </div>
    </div>
  )
}

function StatCell({ label, value, mono, color, sub, subColor }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div
        className={`text-[12px] ${mono ? 'font-mono' : ''} ${color || 'text-gray-900 dark:text-gray-200'}`}
      >
        {value}
      </div>
      {sub && (
        <div className={`text-[10px] font-mono ${subColor || 'text-gray-500 dark:text-gray-400'}`}>
          {sub}
        </div>
      )}
    </div>
  )
}
