import { useState, useMemo, useEffect, useRef } from 'react'
import { useContextMenu } from '../ContextMenu'
import { getStockChart, autoCreateMarketJournal, getMarketJournals } from '../../api'

// ── Shared style constants ────────────────────────────────────────────────────

const SETUP_TAG_STYLE = {
  Breakout:      'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400',
  Pullback:      'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400',
  Reversal:      'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400',
  'IPO Entry':   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400',
  'Rights Entry':'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/40 text-teal-600 dark:text-teal-400',
  FOMO:          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-500 dark:text-red-400',
  Fundamental:   'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400',
  Other:         'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
}

const EMOTIONAL_STATES = [
  { value: 'confident', label: '💪 Confident', dot: 'bg-blue-400',    pill: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'calm',      label: '😌 Calm',      dot: 'bg-emerald-400', pill: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'anxious',   label: '😰 Anxious',   dot: 'bg-yellow-400',  pill: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'fearful',   label: '😨 Fearful',   dot: 'bg-orange-400',  pill: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'greedy',    label: '🤑 Greedy',    dot: 'bg-red-400',     pill: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'fomo',      label: '😱 FOMO',      dot: 'bg-purple-400',  pill: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'neutral',   label: '😐 Neutral',   dot: 'bg-gray-400',    pill: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
]

const LS_KEY = 'tradeo_logs_trades_view'

function tradeDuration(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  const days = Math.round((new Date(today) - new Date(dateStr)) / 86400000)
  if (days === 1) return '1d'
  return `${days}d`
}

// ── WhatIfPanel (lazy-load) ───────────────────────────────────────────────────

function WhatIfPanel({ trade, getWhatIf }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [fetched, setFetched] = useState(false)
  const isFx  = trade.market === 'forex'
  const cur   = isFx ? '$' : 'Rs.'
  const exitDate = (trade.updated_at || trade.date || '').slice(0, 10)

  const load = () => {
    if (fetched || loading) return
    setLoading(true)
    getWhatIf({
      symbol:      trade.symbol,
      exit_date:   exitDate,
      exit_price:  parseFloat(trade.exit_price),
      entry_price: parseFloat(trade.entry_price),
      position:    trade.position,
    })
      .then(r => { setData(r.data); setFetched(true) })
      .catch(e => { setError(e.response?.data?.error || 'No data'); setFetched(true) })
      .finally(() => setLoading(false))
  }

  if (!trade.exit_price || !exitDate) return null

  const dc = (d) => d == null ? 'text-gray-400' : d > 0 ? 'text-emerald-500' : d < 0 ? 'text-red-400' : 'text-gray-400'
  const fd = (d) => d == null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(2)}%`

  return (
    <div className="flex gap-3">
      <div className="w-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">What If I Had Held?</p>
          {!fetched && (
            <button onClick={load} className="text-[9px] text-amber-500 hover:text-amber-400 font-semibold border border-amber-200 dark:border-amber-800/50 rounded px-1.5 py-0.5 transition-colors">
              Load →
            </button>
          )}
        </div>
        {loading && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-gray-400">Fetching post-exit prices…</span>
          </div>
        )}
        {error && <p className="text-[9px] text-gray-400 italic">{error}</p>}
        {data && !loading && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: '+7d',  snap: data.snapshots?.at7  },
                { label: '+14d', snap: data.snapshots?.at14 },
                { label: '+30d', snap: data.snapshots?.at30 },
              ].map(({ label, snap }) => snap && (
                <div key={label} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2 py-1">
                  <span className="text-[8px] text-gray-400 font-medium">{label}</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{cur}{snap.close.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold tabular-nums ${dc(snap.delta)}`}>{fd(snap.delta)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {data.peak && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-gray-400">Peak</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{cur}{data.peak.price.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold ${dc(data.peak.delta)}`}>{fd(data.peak.delta)}</span>
                  <span className="text-[8px] text-gray-300 dark:text-gray-700">{data.peak.date}</span>
                </div>
              )}
              {data.valley && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-gray-400">Valley</span>
                  <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{cur}{data.valley.price.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold ${dc(data.valley.delta)}`}>{fd(data.valley.delta)}</span>
                  <span className="text-[8px] text-gray-300 dark:text-gray-700">{data.valley.date}</span>
                </div>
              )}
            </div>
            {data.dataPoints != null && (
              <p className="text-[8px] text-gray-300 dark:text-gray-700 italic">
                {data.dataPoints} trading days of post-exit data · % vs your exit {cur}{parseFloat(trade.exit_price).toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TradeRow (Database view row) ──────────────────────────────────────────────

function TradeRow({ trade, ltp, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart, indented = false, isSelected = false, onToggleSelect, getWhatIf }) {
  const [expanded, setExpanded] = useState(false)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const isFx = trade.market === 'forex'
  const fmtPrice = (n) => `${isFx ? '$' : 'Rs.'}${isFx ? parseFloat(n).toFixed(2) : parseFloat(n).toLocaleString()}`
  const fmtPnl   = (n) => `${n > 0 ? '+' : '−'}${isFx ? '$' : 'Rs.'}${isFx ? Math.abs(n).toFixed(2) : Math.abs(Math.round(n)).toLocaleString()}`

  const remaining  = parseInt(trade.remaining_quantity ?? trade.quantity) || 0
  const entryPrice = parseFloat(trade.entry_price) || 0
  const pnl        = parseFloat(trade.realized_pnl) || 0
  const isOpen     = trade.status === 'OPEN' || trade.status === 'PARTIAL'

  const unrealized = ltp?.price && isOpen
    ? (trade.position === 'LONG'
        ? (ltp.price - entryPrice) * remaining
        : (entryPrice - ltp.price) * remaining)
    : null

  const slNear = isOpen && trade.sl && ltp?.price
    ? Math.abs((ltp.price - parseFloat(trade.sl)) / ltp.price) < 0.03
    : false

  const statusConfig = {
    OPEN:    { dot: 'bg-blue-400',  text: 'text-blue-500'  },
    PARTIAL: { dot: 'bg-amber-400', text: 'text-amber-500' },
    CLOSED:  { dot: 'bg-gray-400',  text: 'text-gray-400'  },
  }[trade.status] || { dot: 'bg-gray-400', text: 'text-gray-400' }

  const ctxItems = [
    { label: 'Edit Trade',   icon: '✏️', action: () => onEdit(trade) },
    { label: 'Add Journal',  icon: '📓', action: () => onJournal(trade) },
    { label: 'Go to Chart',  icon: '📈', action: () => onGoToChart(trade) },
    ...(isOpen ? [
      { label: 'Partial Close', icon: '◑', action: () => onPartialClose(trade) },
      { label: 'Close Trade',   icon: '⊠', action: () => onClose(trade) },
    ] : []),
    { separator: true },
    { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(trade.id) },
  ]

  const hasExpand = trade.notes || trade.entry_reason || trade.exit_reflection || (trade.partial_exits?.length > 0) || trade.exit_price

  return (
    <>
      <ContextMenuPortal />
      <tr
        onContextMenu={onContextMenu(ctxItems)}
        onClick={() => hasExpand && setExpanded(!expanded)}
        className={`border-b border-gray-50 dark:border-gray-800/60 transition-colors ${indented ? 'bg-gray-50/60 dark:bg-gray-800/20' : ''} ${
          hasExpand ? 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/30' : 'cursor-default hover:bg-gray-50/40 dark:hover:bg-gray-800/10'
        }`}
      >
        <td className="pl-4 pr-2 py-3.5" onClick={e => e.stopPropagation()}>
          {onToggleSelect && (
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(trade.id)}
              className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer" />
          )}
        </td>
        <td className="px-4 py-3.5" translate="no">
          <p className="text-[10px] text-gray-400 font-medium tabular-nums">{trade.date}</p>
          {isOpen && <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-0.5">{tradeDuration(trade.date)}</p>}
        </td>
        <td className="px-4 py-3.5" translate="no">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-5 rounded-full flex-shrink-0 ${trade.position === 'LONG' ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{trade.symbol}</p>
                {slNear && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="LTP is within 3% of Stop Loss" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className={`text-[9px] font-semibold ${trade.position === 'LONG' ? 'text-emerald-500' : 'text-red-400'}`}>
                  {trade.position === 'LONG' ? '↑ Long' : '↓ Short'}
                </p>
                {isFx && (
                  <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40 text-purple-600 dark:text-purple-400">FX</span>
                )}
                {trade.setup_tag && (
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${SETUP_TAG_STYLE[trade.setup_tag] || SETUP_TAG_STYLE.Other}`}>
                    {trade.setup_tag}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5" translate="no">
          {isFx && trade.lots ? (
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{parseFloat(trade.lots)} lot</span>
          ) : (
            <div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{remaining}</span>
              {remaining !== parseInt(trade.quantity) && (
                <span className="text-[9px] text-gray-300 dark:text-gray-700 tabular-nums"> /{trade.quantity}</span>
              )}
            </div>
          )}
        </td>
        <td className="px-4 py-3.5" translate="no">
          <p className="text-[11px] text-gray-700 dark:text-gray-300 tabular-nums font-medium">
            {parseFloat(trade.entry_price).toFixed(2)}
          </p>
          {ltp?.price && isOpen && (
            <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${ltp.price >= entryPrice ? 'text-emerald-500' : 'text-red-400'}`}>
              {ltp.price.toFixed(2)}
              {ltp.latestDate && <span className="text-gray-300 dark:text-gray-700 font-normal ml-1">{ltp.latestDate}</span>}
            </p>
          )}
        </td>
        <td className="px-4 py-3.5" translate="no">
          <div className="space-y-0.5">
            {trade.sl
              ? <p className="text-[10px] tabular-nums">
                  <span className={`font-semibold mr-1 ${slNear ? 'text-red-500' : 'text-red-400'}`}>SL</span>
                  <span className="text-gray-500 dark:text-gray-400">{parseFloat(trade.sl).toFixed(2)}</span>
                  {slNear && <span className="ml-1 text-red-400">⚠</span>}
                </p>
              : <p className="text-[9px] text-gray-200 dark:text-gray-800">No SL</p>
            }
            {trade.tp && (
              <p className="text-[10px] tabular-nums">
                <span className="text-emerald-400 font-semibold mr-1">TP</span>
                <span className="text-gray-500 dark:text-gray-400">{parseFloat(trade.tp).toFixed(2)}</span>
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-3.5" translate="no">
          {pnl !== 0 ? (
            <p className={`text-[12px] font-bold tabular-nums ${pnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {pnl > 0 ? '+' : '−'}{isFx ? '$' : 'Rs.'}
              {isFx ? Math.abs(pnl).toFixed(2) : Math.abs(Math.round(pnl)).toLocaleString()}
            </p>
          ) : (
            <span className="text-[11px] text-gray-300 dark:text-gray-700">—</span>
          )}
          {unrealized !== null && (
            <p className={`text-[9px] tabular-nums font-medium mt-0.5 ${unrealized > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealized > 0 ? '+' : '−'}{isFx ? '$' : 'Rs.'}
              {isFx ? Math.abs(unrealized).toFixed(2) : Math.abs(Math.round(unrealized)).toLocaleString()} unreal.
            </p>
          )}
        </td>
        <td className="px-4 py-3.5" translate="no">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-semibold ${statusConfig.text}`}>{trade.status}</span>
          </div>
        </td>
        <td className="px-4 py-3.5">
          {hasExpand && (
            <svg className={`w-3 h-3 text-gray-300 dark:text-gray-700 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/60 dark:bg-gray-800/20">
          <td colSpan={9} className="px-4 pt-0 pb-4">
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800/60 grid grid-cols-1 gap-3">
              {trade.entry_reason && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Why I took this</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.entry_reason}</p>
                  </div>
                </div>
              )}
              {trade.exit_reflection && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-violet-200 dark:bg-violet-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">What happened</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.exit_reflection}</p>
                  </div>
                </div>
              )}
              {trade.notes && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-blue-200 dark:bg-blue-800/50 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Trade Thesis</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{trade.notes}</p>
                  </div>
                </div>
              )}
              {trade.partial_exits?.length > 0 && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 flex-shrink-0" />
                  <div className="w-full">
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-2">Partial Exits</p>
                    <div className="flex flex-wrap gap-2">
                      {trade.partial_exits.map((pe, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                            {pe.exit_quantity} @ {fmtPrice(pe.exit_price)}
                          </span>
                          <span className={`text-[10px] font-bold tabular-nums ${pe.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {fmtPnl(pe.pnl)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {trade.exit_price && (
                <div className="flex gap-3">
                  <div className="w-0.5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1">Full Exit</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 tabular-nums font-medium">{fmtPrice(trade.exit_price)}</p>
                      {trade.mfe != null && (
                        <span className="text-[10px] tabular-nums">
                          <span className="font-semibold text-emerald-500">MFE</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">{fmtPrice(trade.mfe)}</span>
                        </span>
                      )}
                      {trade.mae != null && (
                        <span className="text-[10px] tabular-nums">
                          <span className="font-semibold text-red-400">MAE</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">{fmtPrice(trade.mae)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {trade.status === 'CLOSED' && trade.exit_price && getWhatIf && (
                <WhatIfPanel trade={trade} getWhatIf={getWhatIf} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── GroupedTradeRow ───────────────────────────────────────────────────────────

function GroupedTradeRow({ symbol, entries, ltp, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart, onToggleSelect, selectedIds, getWhatIf }) {
  const [expanded, setExpanded] = useState(false)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const totalQty   = entries.reduce((s, t) => s + (parseInt(t.remaining_quantity ?? t.quantity) || 0), 0)
  const avgEntry   = totalQty > 0
    ? entries.reduce((s, t) => s + (parseFloat(t.entry_price) || 0) * (parseInt(t.remaining_quantity ?? t.quantity) || 0), 0) / totalQty
    : 0
  const totalPnl   = entries.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
  const anySlNear  = entries.some(t => ltp?.price && t.sl && Math.abs((ltp.price - parseFloat(t.sl)) / ltp.price) < 0.03)
  const unrealized = ltp?.price
    ? entries.reduce((s, t) => {
        const rem = parseInt(t.remaining_quantity ?? t.quantity) || 0
        const ep  = parseFloat(t.entry_price) || 0
        return s + (t.position === 'LONG' ? (ltp.price - ep) * rem : (ep - ltp.price) * rem)
      }, 0)
    : null

  const statuses  = [...new Set(entries.map(t => t.status))]
  const groupStatus = statuses.length === 1 ? statuses[0] : 'MIXED'
  const posLabels   = [...new Set(entries.map(t => t.position))]
  const posLabel    = posLabels.length === 1 ? posLabels[0] : 'MIXED'

  const statusConfig = {
    OPEN:    { dot: 'bg-blue-400',  text: 'text-blue-500' },
    PARTIAL: { dot: 'bg-amber-400', text: 'text-amber-500' },
    CLOSED:  { dot: 'bg-gray-400',  text: 'text-gray-400' },
    MIXED:   { dot: 'bg-violet-400',text: 'text-violet-500' },
  }[groupStatus] || { dot: 'bg-gray-400', text: 'text-gray-400' }

  const gFmtPnl = (n) =>
    `${n > 0 ? '+' : '−'}Rs.${Math.abs(Math.round(n)).toLocaleString()}`

  const ctxItems = [
    { label: 'Edit…', icon: '✏️', action: () => onEdit(entries[0]) },
    { label: 'Go to Chart', icon: '📈', action: () => onGoToChart(entries[0]) },
    ...(groupStatus !== 'CLOSED' ? [
      { label: 'Close All', icon: '⊠', action: () => onClose(entries[0]) },
    ] : []),
  ]

  return (
    <>
      <ContextMenuPortal />
      <tr
        onContextMenu={onContextMenu(ctxItems)}
        onClick={() => setExpanded(!expanded)}
        className="border-b border-gray-50 dark:border-gray-800/60 bg-blue-50/30 dark:bg-blue-900/5 cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-colors"
      >
        <td className="pl-4 pr-2 py-3" onClick={e => e.stopPropagation()}>
          <input type="checkbox"
            checked={entries.every(t => selectedIds?.has(t.id))}
            onChange={() => entries.forEach(t => onToggleSelect?.(t.id))}
            className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer" />
        </td>
        <td className="px-4 py-3" translate="no">
          <p className="text-[10px] text-gray-400 font-medium tabular-nums">
            {entries.reduce((min, t) => t.date < min ? t.date : min, entries[0].date)}
          </p>
          <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-0.5">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </td>
        <td className="px-4 py-3" translate="no">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-5 rounded-full flex-shrink-0 ${posLabel === 'LONG' ? 'bg-emerald-400' : posLabel === 'SHORT' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white tracking-tight">{symbol}</p>
                {anySlNear && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="SL proximity alert" />}
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 tracking-wide">GROUP</span>
              </div>
              <p className={`text-[9px] font-semibold ${posLabel === 'LONG' ? 'text-emerald-500' : posLabel === 'SHORT' ? 'text-red-400' : 'text-amber-500'}`}>
                {posLabel === 'LONG' ? '↑ Long' : posLabel === 'SHORT' ? '↓ Short' : '⇅ Mixed'}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3" translate="no">
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{totalQty}</span>
          <p className="text-[9px] text-gray-400 mt-0.5">total</p>
        </td>
        <td className="px-4 py-3" translate="no">
          <p className="text-[11px] text-gray-700 dark:text-gray-300 tabular-nums font-medium">
            {avgEntry.toFixed(2)} <span className="text-[9px] text-gray-400 font-normal">avg</span>
          </p>
          {ltp?.price && (
            <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${ltp.price >= avgEntry ? 'text-emerald-500' : 'text-red-400'}`}>
              {ltp.price.toFixed(2)}
              {ltp.latestDate && <span className="text-gray-300 dark:text-gray-700 font-normal ml-1">{ltp.latestDate}</span>}
            </p>
          )}
        </td>
        <td className="px-4 py-3" translate="no">
          {(() => {
            const sls = entries.map(t => t.sl).filter(Boolean).map(parseFloat)
            if (sls.length === 0) return <p className="text-[9px] text-gray-200 dark:text-gray-800">No SL</p>
            const minSl = Math.min(...sls), maxSl = Math.max(...sls)
            return (
              <p className={`text-[10px] tabular-nums ${anySlNear ? 'text-red-500' : 'text-red-400'}`}>
                <span className="font-semibold mr-1">SL</span>
                {minSl === maxSl ? minSl.toFixed(2) : `${minSl.toFixed(2)}–${maxSl.toFixed(2)}`}
                {anySlNear && <span className="ml-1">⚠</span>}
              </p>
            )
          })()}
        </td>
        <td className="px-4 py-3" translate="no">
          {totalPnl !== 0 ? (
            <p className={`text-[12px] font-bold tabular-nums ${totalPnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{gFmtPnl(totalPnl)}</p>
          ) : <span className="text-[11px] text-gray-300 dark:text-gray-700">—</span>}
          {unrealized !== null && (
            <p className={`text-[9px] tabular-nums font-medium mt-0.5 ${unrealized > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gFmtPnl(unrealized)} unreal.
            </p>
          )}
        </td>
        <td className="px-4 py-3" translate="no">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-semibold ${statusConfig.text}`}>{groupStatus}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && entries.map(trade => (
        <TradeRow key={trade.id} trade={trade} ltp={ltp}
          onEdit={onEdit} onClose={onClose} onPartialClose={onPartialClose}
          onDelete={onDelete} onJournal={onJournal} onGoToChart={onGoToChart}
          onToggleSelect={onToggleSelect} isSelected={selectedIds?.has(trade.id) || false}
          getWhatIf={getWhatIf} indented />
      ))}
    </>
  )
}

// ── NepseMarketSummary — today's NEPSE snapshot for gallery header ────────────

function NepseMarketSummary({ marketJournals }) {
  const [entry, setEntry] = useState(null)
  const fetched = useRef(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)

    // Use prop data the moment it arrives
    const fromProp = (marketJournals || []).find(j => j.date === today)
      || (marketJournals?.length > 0 ? marketJournals[0] : null)
    if (fromProp) { setEntry(fromProp); return }

    // Props empty — fetch once ourselves
    if (fetched.current) return
    fetched.current = true

    getMarketJournals()
      .then(r => {
        const list = r?.data || []
        const found = list.find(j => j.date === today) || list[0] || null
        if (found) { setEntry(found); return }
        // No entries yet — trigger auto-create then re-fetch
        return autoCreateMarketJournal(today)
          .then(() => getMarketJournals())
          .then(r2 => {
            const list2 = r2?.data || []
            const found2 = list2.find(j => j.date === today) || list2[0] || null
            if (found2) setEntry(found2)
          })
      })
      .catch(() => {})
  }, [marketJournals])

  if (!entry) return null

  const pct       = entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const close     = entry.nepse_close != null ? parseFloat(entry.nepse_close) : null
  const advancing = entry.advancing || 0
  const declining = entry.declining || 0
  const unchanged = entry.unchanged || 0
  const total     = advancing + declining + unchanged || 1
  const gainers   = Array.isArray(entry.top_gainers) ? entry.top_gainers : []
  const losers    = Array.isArray(entry.top_losers)  ? entry.top_losers  : []
  const isUp      = pct != null ? pct >= 0 : null

  const advPct = Math.round((advancing / total) * 100)
  const decPct = Math.round((declining / total) * 100)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 mb-4 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap">

        {/* NEPSE index */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUp ? 'bg-emerald-50 dark:bg-emerald-900/20' : isUp === false ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
            <span className={`text-[14px] font-black ${isUp ? 'text-emerald-500' : isUp === false ? 'text-red-400' : 'text-gray-400'}`}>
              {isUp ? '↑' : isUp === false ? '↓' : '—'}
            </span>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">NEPSE · {entry.date}</p>
            <div className="flex items-baseline gap-2">
              {close != null
                ? <span className="text-[16px] font-black text-gray-900 dark:text-white tabular-nums">{close.toLocaleString()}</span>
                : <span className="text-[13px] font-bold text-gray-400">No data</span>
              }
              {pct != null && (
                <span className={`text-[12px] font-bold tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 flex-shrink-0 hidden sm:block" />

        {/* Breadth */}
        {(advancing + declining + unchanged) > 0 && (
          <div className="flex-1 min-w-[120px] max-w-[180px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-emerald-500">{advancing} ↑</span>
              <span className="text-[9px] font-semibold text-gray-400">{unchanged} →</span>
              <span className="text-[9px] font-bold text-red-400">{declining} ↓</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-400" style={{ width: `${advPct}%` }} />
              <div className="bg-gray-200 dark:bg-gray-700" style={{ width: `${100 - advPct - decPct}%` }} />
              <div className="bg-red-400" style={{ width: `${decPct}%` }} />
            </div>
          </div>
        )}

        {/* Divider */}
        {gainers.length > 0 && <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 flex-shrink-0 hidden sm:block" />}

        {/* Top gainers */}
        {gainers.length > 0 && (
          <div className="hidden sm:block flex-shrink-0">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Top Gainers</p>
            <div className="flex items-center gap-1">
              {gainers.slice(0, 3).map(g => (
                <div key={g.symbol} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 px-2 py-0.5 rounded-lg">
                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">{g.symbol}</span>
                  <span className="text-[8px] font-semibold text-emerald-500 tabular-nums">+{parseFloat(g.diff_pct).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {losers.length > 0 && <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 flex-shrink-0 hidden lg:block" />}

        {/* Top losers */}
        {losers.length > 0 && (
          <div className="hidden lg:block flex-shrink-0">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Top Losers</p>
            <div className="flex items-center gap-1">
              {losers.slice(0, 3).map(l => (
                <div key={l.symbol} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-2 py-0.5 rounded-lg">
                  <span className="text-[9px] font-bold text-red-600 dark:text-red-400">{l.symbol}</span>
                  <span className="text-[8px] font-semibold text-red-400 tabular-nums">{parseFloat(l.diff_pct).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── MiniPriceBar — tiny SVG price-range bar for calendar cells ───────────────

function MiniPriceBar({ trade, ltp }) {
  const entry   = parseFloat(trade.entry_price) || 0
  const exitPrc = trade.exit_price ? parseFloat(trade.exit_price) : ltp?.price || null
  const sl      = trade.sl ? parseFloat(trade.sl) : null
  const tp      = trade.tp ? parseFloat(trade.tp) : null
  const isLong  = trade.position === 'LONG'

  if (!entry) return null

  const prices = [entry, exitPrc, sl, tp].filter(Boolean)
  const minP   = Math.min(...prices) * 0.998
  const maxP   = Math.max(...prices) * 1.002
  const range  = maxP - minP || 1

  const W = 56, H = 20
  const toX = (p) => ((p - minP) / range) * W

  const pnlColor = exitPrc
    ? (isLong ? (exitPrc >= entry ? '#10b981' : '#f87171') : (exitPrc <= entry ? '#10b981' : '#f87171'))
    : '#60a5fa'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      {/* Base track */}
      <rect x={0} y={H / 2 - 1} width={W} height={2} fill="rgba(0,0,0,0.06)" rx="1" />

      {/* SL marker */}
      {sl && (
        <rect x={Math.max(0, toX(sl) - 0.5)} y={H / 2 - 4} width={1} height={8} fill="#f87171" opacity="0.7" rx="0.5" />
      )}
      {/* TP marker */}
      {tp && (
        <rect x={Math.min(W - 1, toX(tp) - 0.5)} y={H / 2 - 4} width={1} height={8} fill="#10b981" opacity="0.7" rx="0.5" />
      )}

      {/* Entry→Exit bar */}
      {exitPrc && (
        <rect
          x={Math.min(toX(entry), toX(exitPrc))}
          y={H / 2 - 2}
          width={Math.abs(toX(exitPrc) - toX(entry)) || 2}
          height={4}
          fill={pnlColor}
          opacity="0.4"
          rx="1"
        />
      )}

      {/* Entry dot */}
      <circle cx={toX(entry)} cy={H / 2} r={2.5} fill={isLong ? '#3b82f6' : '#f59e0b'} />

      {/* Exit dot */}
      {exitPrc && (
        <circle cx={toX(exitPrc)} cy={H / 2} r={2.5} fill={pnlColor} />
      )}
    </svg>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ trades, ltpMap, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart }) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  // Group trades by date
  const byDate = useMemo(() => {
    const map = {}
    for (const t of trades) {
      if (!t.date) continue
      const [ty, tm] = t.date.split('-').map(Number)
      if (ty !== year || tm - 1 !== month) continue
      const d = parseInt(t.date.slice(8))
      if (!map[d]) map[d] = []
      map[d].push(t)
    }
    return map
  }, [trades, year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">{monthLabel}</p>
        <button onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-gray-300 dark:text-gray-700 uppercase tracking-widest py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Blank cells before first day */}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[90px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dayTrades = byDate[day] || []
          const dayPnl    = dayTrades.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0)
          const hasTrades = dayTrades.length > 0
          const isToday   = year === today.getFullYear() && month === today.getMonth() && day === today.getDate()

          return (
            <div key={day} className={`min-h-[90px] rounded-xl border p-1.5 transition-colors ${
              isToday
                ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                : hasTrades
                  ? dayPnl > 0
                    ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-900/5'
                    : dayPnl < 0
                    ? 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/5'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                  : 'border-gray-100 dark:border-gray-800/60 bg-white dark:bg-gray-900/50'
            }`}>
              {/* Day number */}
              <p className={`text-[10px] font-bold mb-1 ${
                isToday ? 'text-blue-500' : hasTrades ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700'
              }`}>{day}</p>

              {/* Daily P&L if trades exist */}
              {hasTrades && dayPnl !== 0 && (
                <p className={`text-[9px] font-bold tabular-nums mb-1 ${dayPnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {dayPnl > 0 ? '+' : '−'}Rs.{Math.abs(Math.round(dayPnl)).toLocaleString()}
                </p>
              )}

              {/* Trade chips with mini price bar */}
              <div className="space-y-0.5">
                {dayTrades.slice(0, 3).map(t => {
                  const isFx   = t.market === 'forex'
                  const ltp    = ltpMap?.[t.symbol]
                  const pnl    = parseFloat(t.realized_pnl) || 0
                  const chipColor = t.status === 'CLOSED'
                    ? pnl >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30'
                    : t.status === 'PARTIAL'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30'

                  return (
                    <div key={t.id}
                      className={`rounded-md text-[8px] font-semibold overflow-hidden ${chipColor}`}
                      onClick={e => { e.stopPropagation(); onEdit(t) }}
                    >
                      {/* Symbol row */}
                      <div className="flex items-center justify-between gap-1 px-1.5 pt-0.5">
                        <span className="truncate font-bold tracking-wide">{t.symbol}</span>
                        <span className="flex-shrink-0 opacity-60 text-[7px]">
                          {t.position === 'LONG' ? '↑' : '↓'}
                          {t.status === 'OPEN' ? ' OPN' : t.status === 'PARTIAL' ? ' PRT' : ''}
                        </span>
                      </div>
                      {/* Mini price bar — only for NEPSE */}
                      {!isFx && (
                        <div className="px-1 pb-0.5">
                          <MiniPriceBar trade={t} ltp={ltp} />
                        </div>
                      )}
                    </div>
                  )
                })}
                {dayTrades.length > 3 && (
                  <p className="text-[8px] text-gray-400 pl-1">+{dayTrades.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TradeChartFallback — static price range visual when OHLCV unavailable ────

function TradeChartFallback({ trade, isDark }) {
  const entry  = parseFloat(trade.entry_price) || 0
  const exit   = trade.exit_price ? parseFloat(trade.exit_price) : null
  const sl     = trade.sl ? parseFloat(trade.sl) : null
  const tp     = trade.tp ? parseFloat(trade.tp) : null
  const isLong = trade.position === 'LONG'
  const pnl    = parseFloat(trade.realized_pnl) || 0

  const prices = [entry, exit, sl, tp].filter(Boolean)
  if (!prices.length) return null

  const minP  = Math.min(...prices) * 0.97
  const maxP  = Math.max(...prices) * 1.03
  const range = maxP - minP || 1

  const W = 340, H = 110, padL = 20, padR = 20, padT = 18, padB = 18
  const chartH = H - padT - padB
  const chartW = W - padL - padR

  const toY = (p) => padT + chartH - ((p - minP) / range) * chartH
  const bg      = isDark ? '#111827' : '#f9fafb'
  const gridCol = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const textCol = isDark ? '#6b7280' : '#9ca3af'

  const entryColor = isLong ? '#3b82f6' : '#f59e0b'
  const exitColor  = exit ? (isLong ? (exit >= entry ? '#10b981' : '#f87171') : (exit <= entry ? '#10b981' : '#f87171')) : '#60a5fa'

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect width={W} height={H} fill={bg} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={padL} x2={W - padR} y1={padT + chartH * f} y2={padT + chartH * f}
          stroke={gridCol} strokeWidth="1" />
      ))}

      {/* SL */}
      {sl && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(sl)} y2={toY(sl)}
            stroke="#f87171" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
          <text x={padL + 3} y={toY(sl) - 3} fontSize="8" fill="#f87171" opacity="0.9">SL {sl.toFixed(0)}</text>
        </>
      )}

      {/* TP */}
      {tp && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(tp)} y2={toY(tp)}
            stroke="#10b981" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
          <text x={padL + 3} y={toY(tp) - 3} fontSize="8" fill="#10b981" opacity="0.9">TP {tp.toFixed(0)}</text>
        </>
      )}

      {/* Entry line */}
      <line x1={padL} x2={W - padR} y1={toY(entry)} y2={toY(entry)}
        stroke={entryColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.9" />
      <text x={W - padR - 3} y={toY(entry) - 3} textAnchor="end" fontSize="8" fill={entryColor}>
        Entry {entry.toFixed(0)}
      </text>

      {/* Exit line */}
      {exit && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(exit)} y2={toY(exit)}
            stroke={exitColor} strokeWidth="1.5" opacity="0.9" />
          <text x={W - padR - 3} y={toY(exit) + 10} textAnchor="end" fontSize="8" fill={exitColor}>
            Exit {exit.toFixed(0)}
          </text>
          {/* P&L label */}
          <text x={W / 2} y={(toY(entry) + toY(exit)) / 2 + 4} textAnchor="middle"
            fontSize="9" fontWeight="700" fill={exitColor} opacity="0.85">
            {pnl >= 0 ? '+' : ''}Rs.{Math.abs(Math.round(pnl)).toLocaleString()}
          </text>
        </>
      )}

      {/* No exit — show open label */}
      {!exit && (
        <text x={W / 2} y={H / 2 + 4} textAnchor="middle"
          fontSize="9" fill={textCol} opacity="0.6">
          Open Position · {trade.date}
        </text>
      )}

      {/* Entry dot */}
      <circle cx={exit ? padL + chartW * 0.25 : W / 2} cy={toY(entry)} r={4} fill={entryColor} />
      {/* Exit dot */}
      {exit && <circle cx={padL + chartW * 0.75} cy={toY(exit)} r={4} fill={exitColor} />}
      {/* Connecting line between dots */}
      {exit && (
        <line
          x1={padL + chartW * 0.25} y1={toY(entry)}
          x2={padL + chartW * 0.75} y2={toY(exit)}
          stroke={exitColor} strokeWidth="1.5" opacity="0.4" strokeDasharray="3,2"
        />
      )}
    </svg>
  )
}

// ── Trade Chart (SVG candlestick mini-chart for GalleryCard) ─────────────────

function TradeChart({ trade, isDark }) {
  const [candles, setCandles] = useState(null)
  const [err,     setErr]     = useState(false)
  const fetched = useRef(false)
  const isFx    = trade.market === 'forex'

  useEffect(() => {
    if (isFx || fetched.current) return
    fetched.current = true

    const entryDate = trade.date
    const today     = new Date().toISOString().slice(0, 10)
    const exitDate  = trade.exit_price
      ? (trade.updated_at || today).slice(0, 10)
      : today

    // Fetch 1Y of data, we'll slice to the relevant window
    // Abort spinner after 8s if no response
    const timer = setTimeout(() => setErr(true), 8000)

    getStockChart({ symbol: trade.symbol, timeframe: '1Y' })
      .then(res => {
        clearTimeout(timer)
        const data = res.data?.data || res.data?.candles || []
        if (!data.length) { setErr(true); return }

        // Find the relevant slice: entry date → exit date (or today)
        // For open trades show from entry to today; closed from entry to exit
        const startIdx = Math.max(0, data.findIndex(c => c.time >= entryDate))
        const endIdx   = data.findIndex(c => c.time > exitDate)
        const slice    = endIdx === -1 ? data.slice(startIdx) : data.slice(startIdx, endIdx + 1)

        // Need at least 2 candles
        if (slice.length < 2) {
          // Fallback: show last 60 bars with entry date marked
          setCandles({ bars: data.slice(-60), entry: entryDate, exit: exitDate, allData: data })
        } else {
          setCandles({ bars: slice, entry: entryDate, exit: exitDate, allData: data })
        }
      })
      .catch(() => { clearTimeout(timer); setErr(true) })
  }, [trade.symbol, trade.date, trade.exit_price, trade.updated_at, isFx])

  if (isFx) return null
  if (err)   return <TradeChartFallback trade={trade} isDark={isDark} />
  if (!candles) return (
    <div className="h-[110px] flex items-center justify-center gap-2">
      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin opacity-40" />
      <span className="text-[9px] text-gray-300 dark:text-gray-700">Loading chart…</span>
    </div>
  )

  const { bars, entry: entryDate, exit: exitDate } = candles
  const W = 340, H = 110, padL = 4, padR = 4, padT = 6, padB = 18

  const highs  = bars.map(c => c.high)
  const lows   = bars.map(c => c.low)
  const minP   = Math.min(...lows)
  const maxP   = Math.max(...highs)
  const range  = maxP - minP || 1

  const entry    = parseFloat(trade.entry_price)
  const exitPrc  = trade.exit_price ? parseFloat(trade.exit_price) : null
  const sl       = trade.sl ? parseFloat(trade.sl) : null
  const tp       = trade.tp ? parseFloat(trade.tp) : null
  const today    = new Date().toISOString().slice(0, 10)

  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW   = Math.max(1.5, Math.min(6, chartW / bars.length - 1))
  const step   = chartW / Math.max(bars.length - 1, 1)

  const toX = (i) => padL + i * step
  const toY = (p) => padT + chartH - ((p - minP) / range) * chartH

  // Clamp price to chart area for lines (SL/TP may be outside range)
  const clamp = (p) => Math.min(maxP * 1.01, Math.max(minP * 0.99, p))

  const today_idx = bars.findIndex(c => c.time === today)
  const isLong    = trade.position === 'LONG'

  const bg      = isDark ? '#111827' : '#f9fafb'
  const gridCol = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const textCol = isDark ? '#6b7280' : '#9ca3af'

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect width={W} height={H} fill={bg} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f}
          x1={padL} x2={W - padR}
          y1={padT + chartH * f} y2={padT + chartH * f}
          stroke={gridCol} strokeWidth="1" />
      ))}

      {/* SL line */}
      {sl && sl >= minP * 0.95 && sl <= maxP * 1.05 && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(sl)} y2={toY(sl)}
            stroke="#f87171" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
          <text x={W - padR - 2} y={toY(sl) - 2} textAnchor="end"
            fontSize="7" fill="#f87171" opacity="0.9">SL {sl.toFixed(0)}</text>
        </>
      )}

      {/* TP line */}
      {tp && tp >= minP * 0.95 && tp <= maxP * 1.05 && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(tp)} y2={toY(tp)}
            stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
          <text x={W - padR - 2} y={toY(tp) - 2} textAnchor="end"
            fontSize="7" fill="#10b981" opacity="0.9">TP {tp.toFixed(0)}</text>
        </>
      )}

      {/* Entry line */}
      <line x1={padL} x2={W - padR} y1={toY(entry)} y2={toY(entry)}
        stroke={isLong ? '#3b82f6' : '#f59e0b'} strokeWidth="1.5" strokeDasharray="4,2" opacity="0.9" />
      <text x={padL + 2} y={toY(entry) - 2}
        fontSize="7" fill={isLong ? '#3b82f6' : '#f59e0b'} opacity="1">
        Entry {entry.toFixed(0)}
      </text>

      {/* Exit line */}
      {exitPrc && (
        <>
          <line x1={padL} x2={W - padR} y1={toY(exitPrc)} y2={toY(exitPrc)}
            stroke={exitPrc >= entry ? '#10b981' : '#f87171'} strokeWidth="1.5" opacity="0.9" />
          <text x={padL + 2} y={toY(exitPrc) + 8}
            fontSize="7" fill={exitPrc >= entry ? '#10b981' : '#f87171'} opacity="1">
            Exit {exitPrc.toFixed(0)}
          </text>
        </>
      )}

      {/* Candles */}
      {bars.map((c, i) => {
        const x     = toX(i)
        const isUp  = c.close >= c.open
        const col   = isUp ? '#10b981' : '#f87171'
        const bodyT = toY(Math.max(c.open, c.close))
        const bodyB = toY(Math.min(c.open, c.close))
        const bodyH = Math.max(1, bodyB - bodyT)
        const isT   = c.time === today

        return (
          <g key={c.time}>
            {/* Wick */}
            <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)}
              stroke={isT ? '#60a5fa' : col} strokeWidth="1" opacity={isT ? 1 : 0.7} />
            {/* Body */}
            <rect x={x - barW / 2} y={bodyT} width={barW} height={bodyH}
              fill={isT ? '#60a5fa' : col}
              opacity={isT ? 1 : (c.time >= entryDate ? 0.85 : 0.3)}
              rx="0.5" />
          </g>
        )
      })}

      {/* Today highlight glow */}
      {today_idx !== -1 && (
        <rect
          x={toX(today_idx) - barW}
          y={padT}
          width={barW * 2}
          height={chartH}
          fill="#3b82f6"
          opacity="0.06"
          rx="2"
        />
      )}

      {/* Date labels */}
      {bars.length > 0 && (
        <>
          <text x={padL} y={H - 4} fontSize="7" fill={textCol}>{bars[0].time?.slice(5)}</text>
          <text x={W - padR} y={H - 4} textAnchor="end" fontSize="7" fill={textCol}>
            {bars[bars.length - 1].time?.slice(5)}
          </text>
        </>
      )}
    </svg>
  )
}

// ── Gallery View ──────────────────────────────────────────────────────────────

function GalleryCard({ trade, ltp, journals, onEdit, onClose, onPartialClose, onDelete, onJournal, onGoToChart }) {
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const [isDark] = useState(() => document.documentElement.classList.contains('dark'))
  const isFx      = trade.market === 'forex'
  const remaining = parseInt(trade.remaining_quantity ?? trade.quantity) || 0
  const entry     = parseFloat(trade.entry_price) || 0
  const pnl       = parseFloat(trade.realized_pnl) || 0
  const isOpen    = trade.status === 'OPEN' || trade.status === 'PARTIAL'

  const unrealized = ltp?.price && isOpen
    ? (trade.position === 'LONG' ? (ltp.price - entry) * remaining : (entry - ltp.price) * remaining)
    : null

  const slNear = isOpen && trade.sl && ltp?.price
    ? Math.abs((ltp.price - parseFloat(trade.sl)) / ltp.price) < 0.03
    : false

  const linked   = journals?.find(j => j.trade_id === trade.id)
  const emotion  = linked ? EMOTIONAL_STATES.find(e => e.value === linked.emotional_state) : null

  const fmtPnl = (n) => `${n >= 0 ? '+' : '−'}${isFx ? '$' : 'Rs.'}${isFx ? Math.abs(n).toFixed(2) : Math.abs(Math.round(n)).toLocaleString()}`

  const ctxItems = [
    { label: 'Edit Trade',  icon: '✏️', action: () => onEdit(trade) },
    { label: 'Add Journal', icon: '📓', action: () => onJournal(trade) },
    { label: 'Go to Chart', icon: '📈', action: () => onGoToChart(trade) },
    ...(isOpen ? [
      { label: 'Partial Close', icon: '◑', action: () => onPartialClose(trade) },
      { label: 'Close Trade',   icon: '⊠', action: () => onClose(trade) },
    ] : []),
    { separator: true },
    { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(trade.id) },
  ]

  return (
    <div
      onContextMenu={onContextMenu(ctxItems)}
      className={`bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden hover:shadow-md dark:hover:shadow-none transition-all cursor-default ${
        slNear
          ? 'border-red-300 dark:border-red-800/60'
          : trade.status === 'OPEN'
          ? 'border-blue-200 dark:border-blue-800/40'
          : trade.status === 'PARTIAL'
          ? 'border-amber-200 dark:border-amber-800/40'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <ContextMenuPortal />

      {/* ── Chart preview ── */}
      {!isFx && (
        <div className="relative border-b border-gray-100 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-800/40" style={{ height: 110 }}>
          <TradeChart trade={trade} isDark={isDark} />
          {/* Overlay: symbol + status badge */}
          <div className="absolute top-2 left-2.5 flex items-center gap-1.5">
            <span className="text-[12px] font-black text-gray-900 dark:text-white drop-shadow-sm tracking-tight">{trade.symbol}</span>
            {slNear && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
          </div>
          <div className="absolute top-2 right-2.5">
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
              trade.status === 'OPEN'    ? 'bg-blue-500/90 text-white' :
              trade.status === 'PARTIAL' ? 'bg-amber-500/90 text-white' :
                                           'bg-gray-500/80 text-white'
            }`}>{trade.status}</span>
          </div>
          {/* Emotion accent stripe */}
          {emotion && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${emotion.dot}`} />}
        </div>
      )}

      {/* Emotion accent bar (forex fallback) */}
      {isFx && emotion && <div className={`h-0.5 w-full ${emotion.dot}`} />}

      <div className="p-3.5">
        {/* Header row — symbol already shown in chart overlay for NEPSE */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isFx && <p className="text-[14px] font-black text-gray-900 dark:text-white tracking-tight">{trade.symbol}</p>}
              {!isFx && <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{trade.symbol}</p>}
              {slNear && !isFx && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="SL near" />}
              {isFx && slNear && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="SL near" />}
              {isFx && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40 text-purple-600 dark:text-purple-400">FX</span>}
              {trade.setup_tag && (
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${SETUP_TAG_STYLE[trade.setup_tag] || SETUP_TAG_STYLE.Other}`}>
                  {trade.setup_tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[9px] font-bold ${trade.position === 'LONG' ? 'text-emerald-500' : 'text-red-400'}`}>
                {trade.position === 'LONG' ? '↑ Long' : '↓ Short'}
              </span>
              <span className="text-[9px] text-gray-300 dark:text-gray-700">·</span>
              <span className="text-[9px] text-gray-400 tabular-nums">{trade.date}</span>
              {isOpen && <span className="text-[9px] text-gray-300 dark:text-gray-700">· {tradeDuration(trade.date)}</span>}
            </div>
          </div>

          {/* Status badge — only shown for FX (NEPSE shows it in chart overlay) */}
          {isFx && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
              trade.status === 'OPEN'    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
              trade.status === 'PARTIAL' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                           'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>{trade.status}</span>
          )}
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-widest text-gray-400 font-semibold">Entry</p>
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 tabular-nums mt-0.5">{entry.toFixed(2)}</p>
          </div>
          {trade.sl && (
            <div className={`rounded-lg px-2 py-1.5 ${slNear ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
              <p className={`text-[7px] uppercase tracking-widest font-semibold ${slNear ? 'text-red-400' : 'text-gray-400'}`}>SL {slNear ? '⚠' : ''}</p>
              <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${slNear ? 'text-red-500' : 'text-red-400'}`}>{parseFloat(trade.sl).toFixed(2)}</p>
            </div>
          )}
          {trade.tp ? (
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1.5">
              <p className="text-[7px] uppercase tracking-widest text-gray-400 font-semibold">TP</p>
              <p className="text-[11px] font-bold text-emerald-500 tabular-nums mt-0.5">{parseFloat(trade.tp).toFixed(2)}</p>
            </div>
          ) : !trade.sl ? (
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1.5">
              <p className="text-[7px] uppercase tracking-widest text-gray-400 font-semibold">Qty</p>
              <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 tabular-nums mt-0.5">{remaining}</p>
            </div>
          ) : null}
        </div>

        {/* LTP for open trades */}
        {ltp?.price && isOpen && (
          <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-3 ${
            ltp.price >= entry ? 'bg-emerald-50 dark:bg-emerald-900/15' : 'bg-red-50 dark:bg-red-900/15'
          }`}>
            <span className="text-[9px] text-gray-400 font-semibold">LTP</span>
            <span className={`text-[11px] font-bold tabular-nums ${ltp.price >= entry ? 'text-emerald-500' : 'text-red-400'}`}>
              {ltp.price.toFixed(2)}
            </span>
          </div>
        )}

        {/* P&L row */}
        <div className="flex items-center justify-between">
          <div>
            {pnl !== 0 ? (
              <p className={`text-[16px] font-black tracking-tight tabular-nums ${pnl > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {fmtPnl(pnl)}
              </p>
            ) : (
              <p className="text-[13px] text-gray-300 dark:text-gray-700 font-semibold">No P&L</p>
            )}
            {unrealized !== null && (
              <p className={`text-[9px] font-semibold tabular-nums ${unrealized > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtPnl(unrealized)} unreal.
              </p>
            )}
          </div>
          {emotion && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${emotion.pill}`}>
              {emotion.label}
            </span>
          )}
        </div>

        {/* Exit info for closed trades */}
        {trade.status === 'CLOSED' && trade.exit_price && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-gray-400">Exit</span>
              <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
                {parseFloat(trade.exit_price).toFixed(2)}
              </span>
              {trade.exit_reason && (
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${
                  trade.exit_reason === 'target'   ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  trade.exit_reason === 'stoploss' ? 'bg-red-100 dark:bg-red-900/30 text-red-500'     :
                                                     'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  {trade.exit_reason === 'target' ? 'TP Hit' : trade.exit_reason === 'stoploss' ? 'SL Hit' : 'Manual'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Notes snippet */}
        {(trade.entry_reason || trade.notes) && (
          <p className="mt-2.5 text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed line-clamp-2">
            {trade.entry_reason || trade.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ── View Switcher ─────────────────────────────────────────────────────────────

function ViewSwitcher({ view, onChange }) {
  const opts = [
    {
      key: 'database',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
        </svg>
      ),
      label: 'Database',
    },
    {
      key: 'calendar',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Calendar',
    },
    {
      key: 'gallery',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      label: 'Gallery',
    },
  ]

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
            view === o.key
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Main TradesTab ────────────────────────────────────────────────────────────

export default function TradesTab({
  trades = [],
  journals = [],
  marketJournals = [],
  ltpMap = {},
  market,
  onEdit,
  onClose,
  onPartialClose,
  onDelete,
  onJournal,
  onGoToChart,
  onExportCSV,
  onBulkDelete,
  getWhatIf,
}) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || 'database' } catch { return 'database' }
  })
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSymbol, setSearchSymbol] = useState('')
  const [sort,         setSort]         = useState({ col: 'date', dir: 'desc' })
  const [groupOpen,    setGroupOpen]    = useState(false)
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const changeView = (v) => {
    setView(v)
    try { localStorage.setItem(LS_KEY, v) } catch {}
  }

  const isForex = market === 'forex'

  const filteredTrades = useMemo(() => trades
    .filter(t =>
      (t.market === market || (!t.market && market === 'nepse')) &&
      (filterStatus === 'ALL' || t.status === filterStatus) &&
      (!searchSymbol || t.symbol.includes(searchSymbol.toUpperCase()))
    )
    .sort((a, b) => {
      let av, bv
      if (sort.col === 'date')   { av = a.date;                        bv = b.date }
      if (sort.col === 'symbol') { av = a.symbol;                      bv = b.symbol }
      if (sort.col === 'entry')  { av = parseFloat(a.entry_price);     bv = parseFloat(b.entry_price) }
      if (sort.col === 'qty')    { av = parseInt(a.remaining_quantity ?? a.quantity); bv = parseInt(b.remaining_quantity ?? b.quantity) }
      if (sort.col === 'pnl')    { av = parseFloat(a.realized_pnl) || 0; bv = parseFloat(b.realized_pnl) || 0 }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    }),
  [trades, market, filterStatus, searchSymbol, sort])

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: col === 'pnl' ? 'desc' : 'asc' }
    )
  }

  const toggleSelectId  = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filteredTrades.length
      ? new Set()
      : new Set(filteredTrades.map(t => t.id))
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await onBulkDelete([...selectedIds])
      setSelectedIds(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }

  // Common handler props for all views
  const handlerProps = {
    onEdit:         (t) => onEdit(t),
    onClose:        (t) => onClose(t),
    onPartialClose: (t) => onPartialClose(t),
    onDelete:       (id) => onDelete(id),
    onJournal:      (t) => onJournal(t),
    onGoToChart:    (t) => onGoToChart(t),
  }

  return (
    <div>
      {/* ── View-specific toolbar ── */}
      {view === 'database' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap bg-gray-50/60 dark:bg-gray-800/30">

            {/* Status pill filters */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'ALL',     label: 'All',     dot: null },
                { key: 'OPEN',    label: 'Open',    dot: 'bg-blue-400' },
                { key: 'PARTIAL', label: 'Partial', dot: 'bg-amber-400' },
                { key: 'CLOSED',  label: 'Closed',  dot: 'bg-gray-400' },
              ].map(s => (
                <button key={s.key} onClick={() => { setFilterStatus(s.key); setSelectedIds(new Set()) }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    filterStatus === s.key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
                  {s.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={searchSymbol}
                onChange={e => { setSearchSymbol(e.target.value); setSelectedIds(new Set()) }}
                placeholder="Symbol…"
                className="pl-7 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 w-28 transition-colors" />
            </div>

            {/* Group toggle */}
            <button onClick={() => setGroupOpen(g => !g)}
              title="Group open positions by symbol"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                groupOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              Group
            </button>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{selectedIds.size} selected</span>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                    Clear
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-50 transition-all">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 tabular-nums">
                    {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
                  </span>
                  {filteredTrades.length > 0 && (
                    <button onClick={onExportCSV}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      CSV
                    </button>
                  )}
                </div>
              )}
              <ViewSwitcher view={view} onChange={changeView} />
            </div>
          </div>

          {/* Table */}
          {filteredTrades.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mx-auto mb-3 border border-gray-100 dark:border-gray-800">
                <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">No trades found</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">Log a trade or adjust filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                    <th className="pl-4 pr-2 py-2.5 w-8">
                      <input type="checkbox"
                        checked={filteredTrades.length > 0 && selectedIds.size === filteredTrades.length}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer" />
                    </th>
                    {[
                      { label: 'Date',        col: 'date'   },
                      { label: 'Symbol',      col: 'symbol' },
                      { label: 'Qty',         col: 'qty'    },
                      { label: 'Entry / LTP', col: 'entry'  },
                      { label: 'SL / TP',     col: null     },
                      { label: 'P&L',         col: 'pnl'    },
                      { label: 'Status',      col: null     },
                      { label: '',            col: null     },
                    ].map((h, i) => (
                      <th key={i} onClick={() => h.col && toggleSort(h.col)}
                        className={`px-4 py-2.5 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest select-none ${h.col ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors' : ''}`}>
                        {h.col ? (
                          <span className="inline-flex items-center gap-1">
                            {h.label}
                            <span className={`transition-opacity ${sort.col === h.col ? 'opacity-100' : 'opacity-30'}`}>
                              {sort.col === h.col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </span>
                        ) : h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupOpen ? (() => {
                    const openFiltered   = filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')
                    const closedFiltered = filteredTrades.filter(t => t.status === 'CLOSED')
                    const groupMap = {}
                    openFiltered.forEach(t => {
                      if (!groupMap[t.symbol]) groupMap[t.symbol] = []
                      groupMap[t.symbol].push(t)
                    })
                    const groups = Object.entries(groupMap)
                    const rp = {
                      ...handlerProps,
                      onToggleSelect: toggleSelectId,
                      getWhatIf,
                    }
                    return (
                      <>
                        {groups.map(([sym, entries]) =>
                          entries.length === 1
                            ? <TradeRow key={entries[0].id} trade={entries[0]} ltp={ltpMap[sym] || null} isSelected={selectedIds.has(entries[0].id)} {...rp} />
                            : <GroupedTradeRow key={sym} symbol={sym} entries={entries} ltp={ltpMap[sym] || null} {...rp} selectedIds={selectedIds} />
                        )}
                        {closedFiltered.map(trade => (
                          <TradeRow key={trade.id} trade={trade} ltp={null} isSelected={selectedIds.has(trade.id)} {...rp} />
                        ))}
                      </>
                    )
                  })() : filteredTrades.map(trade => (
                    <TradeRow key={trade.id} trade={trade} ltp={ltpMap[trade.symbol] || null}
                      {...handlerProps}
                      onToggleSelect={toggleSelectId}
                      isSelected={selectedIds.has(trade.id)}
                      getWhatIf={getWhatIf} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar view ── */}
      {view === 'calendar' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'ALL',     label: 'All',     dot: null },
                { key: 'OPEN',    label: 'Open',    dot: 'bg-blue-400' },
                { key: 'PARTIAL', label: 'Partial', dot: 'bg-amber-400' },
                { key: 'CLOSED',  label: 'Closed',  dot: 'bg-gray-400' },
              ].map(s => (
                <button key={s.key} onClick={() => setFilterStatus(s.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    filterStatus === s.key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
                  {s.label}
                </button>
              ))}
            </div>
            <ViewSwitcher view={view} onChange={changeView} />
          </div>
          <div className="p-4">
            <CalendarView
              trades={filteredTrades}
              ltpMap={ltpMap}
              {...handlerProps}
            />
          </div>
        </div>
      )}

      {/* ── Gallery view ── */}
      {view === 'gallery' && (
        <div>
          {/* Market summary — only for NEPSE tab */}
          {!isForex && <NepseMarketSummary marketJournals={marketJournals} />}

          <div className="flex items-center gap-2 flex-wrap mb-4 px-0.5">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'ALL',     label: 'All',     dot: null },
                { key: 'OPEN',    label: 'Open',    dot: 'bg-blue-400' },
                { key: 'PARTIAL', label: 'Partial', dot: 'bg-amber-400' },
                { key: 'CLOSED',  label: 'Closed',  dot: 'bg-gray-400' },
              ].map(s => (
                <button key={s.key} onClick={() => setFilterStatus(s.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    filterStatus === s.key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={searchSymbol}
                onChange={e => setSearchSymbol(e.target.value)}
                placeholder="Symbol…"
                className="pl-7 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 w-28 transition-colors" />
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums ml-auto">{filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}</span>
            <ViewSwitcher view={view} onChange={changeView} />
          </div>

          {filteredTrades.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mx-auto mb-3 border border-gray-100 dark:border-gray-800">
                <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">No trades found</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">Log a trade or adjust filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredTrades.map(trade => (
                <GalleryCard
                  key={trade.id}
                  trade={trade}
                  ltp={ltpMap[trade.symbol] || null}
                  journals={journals}
                  {...handlerProps}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
