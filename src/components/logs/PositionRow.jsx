import { useState, useEffect, useCallback } from 'react'
import { getTradeHistory } from '../../api'
import { useContextMenu } from '../ContextMenu'
import ActionHistory from './ActionHistory'
import { fmt } from '../../utils/format'

const STATUS_BADGE = {
  OPEN:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  CLOSED:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default function PositionRow({ position, ltp, onAdd, onPartialExit, onClose, onDelete, onEditAction, onDeleteAction }) {
  const [expanded, setExpanded] = useState(false)
  const [actions,  setActions]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const wacc     = parseFloat(position.wacc) || 0
  const totalQty = parseFloat(position.total_qty) || 0
  const ltpNum   = ltp ? parseFloat(ltp) : null
  const isClosed = position.status === 'CLOSED'

  const unrealPnl = ltpNum != null && !isClosed
    ? (position.direction === 'LONG' ? (ltpNum - wacc) * totalQty : (wacc - ltpNum) * totalQty)
    : null

  const fetchHistory = useCallback(async () => {
    if (actions !== null) return
    setLoading(true)
    try {
      const res = await getTradeHistory(position.trade_id)
      setActions(res.data)
    } catch {
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [position.trade_id, actions])

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTradeHistory(position.trade_id)
      setActions(res.data)
    } catch {
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [position.trade_id])

  useEffect(() => {
    if (expanded && actions === null) fetchHistory()
  }, [expanded, fetchHistory])

  const menuItems = isClosed
    ? [
        { label: 'Delete Trade', icon: '🗑', danger: true, action: () => onDelete(position) },
      ]
    : [
        { label: 'Add to Position', icon: '＋', action: () => onAdd(position) },
        { label: 'Partial Exit',    icon: '↗', action: () => onPartialExit(position) },
        { label: 'Close Position',  icon: '✓', action: () => onClose(position) },
        { separator: true },
        { label: 'Delete Trade',    icon: '🗑', danger: true, action: () => onDelete(position) },
      ]

  return (
    <>
      <ContextMenuPortal />
      <div
        className={`group rounded-xl border transition-all duration-150 overflow-hidden
          ${expanded
            ? 'border-blue-200 dark:border-blue-800/60 bg-white dark:bg-gray-900 shadow-sm'
            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm'
          }`}
      >
        {/* ── main row ── */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
          onContextMenu={onContextMenu(menuItems)}
        >
          {/* chevron */}
          <span className={`text-gray-300 dark:text-gray-600 transition-transform duration-150 text-[10px] shrink-0 ${expanded ? 'rotate-90' : ''}`}>▶</span>

          {/* symbol + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[13px] text-gray-900 dark:text-gray-100 tracking-wide">{position.symbol}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                position.direction === 'LONG'
                  ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {position.direction}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[position.status] || STATUS_BADGE.CLOSED}`}>
                {position.status}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 font-mono">
              {position.opened_at?.slice(0, 10)}
            </div>
          </div>

          {/* stats grid */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <Stat label="Qty" value={totalQty} mono />
            <Stat label="WACC" value={`Rs.${fmt(wacc)}`} mono />
            {position.sl && <Stat label="SL" value={`Rs.${fmt(position.sl)}`} mono color="text-red-500 dark:text-red-400" />}
            {position.tp && <Stat label="TP" value={`Rs.${fmt(position.tp)}`} mono color="text-emerald-500 dark:text-emerald-400" />}
            {unrealPnl != null && (
              <Stat
                label="Unreal P&L"
                value={`${unrealPnl >= 0 ? '+' : ''}Rs.${fmt(unrealPnl)}`}
                mono
                color={unrealPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}
              />
            )}
            {isClosed && position.total_realized_pnl != null && (
              <Stat
                label="Realized"
                value={`${parseFloat(position.total_realized_pnl) >= 0 ? '+' : ''}Rs.${fmt(position.total_realized_pnl)}`}
                mono
                color={parseFloat(position.total_realized_pnl) >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}
              />
            )}
          </div>

          {/* right-click hint — fades in on hover */}
          <span className="hidden lg:block text-[9px] text-gray-300 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors shrink-0 select-none pr-1">
            right-click
          </span>
        </div>

        {/* ── expanded history ── */}
        {expanded && (
          <div className="border-t border-gray-50 dark:border-gray-800/60">
            {loading && (
              <div className="flex items-center gap-2 px-6 py-4 text-xs text-gray-400 dark:text-gray-500">
                <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                Loading history…
              </div>
            )}
            {error && (
              <div className="px-6 py-4 text-xs text-red-500">{error}</div>
            )}
            {!loading && !error && actions !== null && (
              <ActionHistory
                actions={actions}
                onEdit={onEditAction}
                onDelete={a => onDeleteAction(a, refreshHistory)}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, mono, color }) {
  return (
    <div className="text-right">
      <div className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-[12px] ${mono ? 'font-mono' : ''} ${color || 'text-gray-800 dark:text-gray-200'}`}>{value}</div>
    </div>
  )
}
