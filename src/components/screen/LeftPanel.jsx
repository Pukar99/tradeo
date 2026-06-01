// === LeftPanel.jsx — screen left panel: portfolio positions, watchlist, BUY/SELL modal, SL/TP alerts ===
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { newPosition, closePosition, removeFromWatchlist, updateWatchlist } from '../../api'
import { getBatchPrices, getWatchlist, clearWatchlistCache } from '../../utils/globalCache'
import { useContextMenu } from '../ContextMenu'
import { useChatRefresh, dispatchChatAction } from '../../utils/chatEvents'
import { useScreen } from '../../context/ScreenContext'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ALERT_PCT_THRESHOLD } from '../../utils/constants'
import { apiError } from '../../utils/format'

// ── BUY / SELL Modal ──────────────────────────────────────────────────────────

function TradeModal({ side, symbol, onClose, onSaved }) {
  const [form, setForm] = useState({ entry_price: '', sl: '', tp: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  useEscapeKey(onClose)

  const isBuy = side === 'BUY'
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.entry_price || !form.quantity) { setErr('Entry price and quantity are required'); return }
    setSaving(true); setErr(null)
    try {
      await newPosition({
        symbol,
        position:    isBuy ? 'LONG' : 'SHORT',
        entry_price: parseFloat(form.entry_price),
        sl:          form.sl       ? parseFloat(form.sl)       : null,
        tp:          form.tp       ? parseFloat(form.tp)       : null,
        quantity:    parseInt(form.quantity),
        notes:       form.notes || null,
        entry_date:  new Date().toISOString().slice(0, 10),
      })
      dispatchChatAction('ADD_TRADE')
      onSaved()
      onClose()
    } catch (e) {
      setErr(apiError(e, 'Failed to save trade'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden flex flex-col max-h-[90vh] animate-modal-in">
        <div className={`flex items-center justify-between px-5 py-4 shrink-0 ${isBuy ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-[11px] font-black">{isBuy ? '↑' : '↓'}</span>
            </div>
            <div>
              <p className="text-[13px] font-black text-white tracking-wide">{isBuy ? 'BUY' : 'SELL'}</p>
              <p className="text-[10px] text-white/70 font-medium" translate="no">{symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors text-white text-[16px]">×</button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {[
            ['Entry Price', 'entry_price', 'e.g. 1234'],
            ['Stop Loss (SL)', 'sl', 'e.g. 1100'],
            ['Target Price (TP)', 'tp', 'e.g. 1400'],
            ['Quantity', 'quantity', 'No. of shares'],
          ].map(([label, key, ph]) => (
            <div key={key}>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
              <input
                type="number"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={ph}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional notes..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all"
            />
          </div>

          {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-xl">{err}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 rounded-xl text-[12px] font-bold text-white transition-all shadow-lg ${
              isBuy
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-200 dark:shadow-emerald-900/40 disabled:opacity-50'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200 dark:shadow-red-900/40 disabled:opacity-50'
            }`}
          >
            {saving ? 'Saving...' : `Confirm ${side}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Close Position Confirm ────────────────────────────────────────────────────

function CloseConfirm({ position, onClose, onDone }) {
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  useEscapeKey(onClose)

  const handleClose = async () => {
    setSaving(true); setErr(null)
    try {
      const latestClose = position._latestPrice || position.entry_price
      await closePosition(position.trade_id, { exit_price: latestClose, date: new Date().toISOString().slice(0, 10) })
      dispatchChatAction('CLOSE_TRADE')
      onDone()
      onClose()
    } catch (e) {
      setErr(apiError(e, 'Failed to close position'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xs z-10 p-5 text-center animate-modal-in">
        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-500 text-[18px]">✕</span>
        </div>
        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mb-1">Close Position?</p>
        <p className="text-[11px] text-gray-400 mb-4" translate="no">
          {position.symbol} · {position.position} · Qty {position.remaining_quantity || 0}
        </p>
        {err && <p className="text-[11px] text-red-500 mb-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-xl">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-[11px] font-bold transition-all disabled:opacity-50 shadow-sm">
            {saving ? '...' : 'Close Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Watchlist Item Form ──────────────────────────────────────────────────

function EditWatchItemForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    watch_low:   item.watch_low   || '',
    watch_high:  item.watch_high  || '',
    price_alert: item.price_alert || '',
    alert_date:  item.alert_date  ? item.alert_date.slice(0, 10) : '',
    notes:       item.notes       || '',
    category:    item.category    || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveErr(null)
    try {
      await updateWatchlist(item.id, {
        watch_low:   form.watch_low   !== '' ? parseFloat(form.watch_low)   : null,
        watch_high:  form.watch_high  !== '' ? parseFloat(form.watch_high)  : null,
        price_alert: form.price_alert !== '' ? parseFloat(form.price_alert) : null,
        alert_date:  form.alert_date  || null,
        notes:       form.notes       || null,
        category:    form.category,
      })
      clearWatchlistCache()
      onSaved()
    } catch (err) {
      setSaveErr(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all'

  return (
    <form onSubmit={handleSave} className="px-4 py-4 space-y-3">
      {saveErr && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">{saveErr}</p>}
      <div className="grid grid-cols-2 gap-2">
        {[['Watch Low (Rs)', 'watch_low', 'number'], ['Watch High (Rs)', 'watch_high', 'number'], ['Price Alert (Rs)', 'price_alert', 'number'], ['Alert Date', 'alert_date', 'date']].map(([label, key, type]) => (
          <div key={key}>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
            <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inp} />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
        <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Why are you watching this?" className={inp} />
      </div>
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Category</label>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
          <option value="active">Active</option>
          <option value="pre">Pre-Watch</option>
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

// ── Position Card ─────────────────────────────────────────────────────────────

const PositionCard = memo(function PositionCard({ p, selected, onSelect, latestPrice, index = 0 }) {
  const isLong   = p.position === 'LONG'
  const entry    = parseFloat(p.entry_price) || 0
  const sl       = p.sl ? parseFloat(p.sl) : null
  const tp       = p.tp ? parseFloat(p.tp) : null
  const lp       = latestPrice || 0
  const pnlPct   = lp && entry ? ((lp - entry) / entry * 100) * (isLong ? 1 : -1) : null
  const isPos    = pnlPct !== null && pnlPct >= 0

  // SL→TP progress: where is current price between SL and TP?
  const progressPct = (sl && tp && lp)
    ? Math.min(100, Math.max(0, ((lp - sl) / (tp - sl)) * 100))
    : null

  return (
    <div
      onClick={() => onSelect(p.symbol, null, p)}
      className={`hp-card cursor-pointer rounded-xl border transition-all group animate-fade-up ${
        selected
          ? isLong
            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40'
            : 'bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40'
          : 'bg-white/60 dark:bg-white/5 border-white/50 dark:border-white/8 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-sm'
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex overflow-hidden rounded-xl">
        {/* Colored left accent — thicker for visibility */}
        <div className={`w-[3px] shrink-0 rounded-l-xl ${isLong ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="flex-1 px-2.5 py-2">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1.5" translate="no">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{p.symbol}</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                isLong ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300'
                       : 'bg-red-100 dark:bg-red-900/80 text-red-600 dark:text-red-300'
              }`}>{isLong ? 'LONG' : 'SHORT'}</span>
            </div>
            {pnlPct !== null ? (
              <span className={`text-[11px] font-black tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
            ) : (
              <span className="text-[11px] text-gray-300 dark:text-gray-600 tabular-nums">—</span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-1 mb-1.5" translate="no">
            <div>
              <p className="text-[8px] text-gray-400 uppercase tracking-wide">Entry</p>
              <p className="text-[10px] font-semibold text-blue-400 tabular-nums">{entry.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[8px] text-gray-400 uppercase tracking-wide">Qty</p>
              <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{p.remaining_quantity || 0}</p>
            </div>
            {sl && (
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-wide">SL</p>
                <p className="text-[10px] font-semibold text-red-400 tabular-nums">{sl.toLocaleString()}</p>
              </div>
            )}
            {tp && (
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-wide">TP</p>
                <p className="text-[10px] font-semibold text-emerald-500 tabular-nums">{tp.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* SL→TP progress bar */}
          {progressPct !== null && (
            <div className="relative h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-gray-200 dark:via-gray-600 to-emerald-400 rounded-full" />
              <div
                className={`absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full ${isPos ? 'bg-emerald-500' : 'bg-red-400'} shadow`}
                style={{ left: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

// ── Watchlist Card ────────────────────────────────────────────────────────────

const WatchlistCard = memo(function WatchlistCard({ w, selected, onSelect, onEdit, onDelete }) {
  const isPre = w.category === 'pre' || w.category === 'pre-watch'
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  return (
    <>
      <ContextMenuPortal />
      <div
        onClick={() => onSelect(w.symbol)}
        onContextMenu={onContextMenu([
          { label: 'Edit', icon: '✏️', action: () => onEdit(w) },
          { separator: true },
          { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(w.id) },
        ])}
        className={`hp-card cursor-pointer rounded-xl border transition-all group animate-fade-up ${
          selected
            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
            : 'bg-white/70 dark:bg-white/5 border-gray-100/80 dark:border-white/8 hover:bg-white/90 dark:hover:bg-white/10 backdrop-blur-sm'
        }`}
      >
        <div className="flex overflow-hidden rounded-xl">
          <div className={`w-0.5 shrink-0 rounded-l-xl ${isPre ? 'bg-amber-400' : 'bg-blue-400'}`} />
          <div className="flex-1 px-2.5 py-2">
            <div className="flex items-center justify-between" translate="no">
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{w.symbol}</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                isPre
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              }`}>{isPre ? 'Pre' : 'Watch'}</span>
            </div>
            {(w.watch_low || w.watch_high) && (
              <div className="flex gap-3 mt-1 text-[9px]" translate="no">
                {w.watch_low  && <span className="text-gray-400">Low <span className="text-red-400 font-semibold">{w.watch_low}</span></span>}
                {w.watch_high && <span className="text-gray-400">High <span className="text-emerald-500 font-semibold">{w.watch_high}</span></span>}
              </div>
            )}
            {w.notes && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{w.notes}</p>}
          </div>
        </div>
      </div>
    </>
  )
})

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeftPanel() {
  const { selectedSymbol, selectSymbol, isIndex, sharedPositions, refreshPositions, positionsLoading } = useScreen()

  const positions = useMemo(() => (sharedPositions || [])
    .filter(p => p.status === 'OPEN' || p.status === 'PARTIAL')
    .map(p => ({
      id:                 p.trade_id,
      symbol:             p.symbol,
      position:           p.direction,
      remaining_quantity: parseFloat(p.total_qty) || 0,
      entry_price:        p.wacc,
      sl:                 p.sl,
      tp:                 p.tp,
      status:             p.status,
    })), [sharedPositions])

  const [watchlist,     setWatchlist]     = useState([])
  const [pendingDelete, setPendingDelete] = useState(null)
  const [tab,           setTab]           = useState('portfolio')
  const [watchErr,      setWatchErr]      = useState(null)
  const [watchLoading,  setWatchLoading]  = useState(true)
  const [latestPrices,  setLatestPrices]  = useState({})

  const [tradeModal,     setTradeModal]     = useState(null)
  const [closeTarget,    setCloseTarget]    = useState(null)
  const [alertPositions, setAlertPositions] = useState([])
  const [editWatchItem,  setEditWatchItem]  = useState(null)

  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const loadWatchlist = useCallback(() => {
    setWatchLoading(true)
    getWatchlist()
      .then(r => {
        if (!mountedRef.current) return
        setWatchlist((r.data || []).filter(w => w.category === 'active' || w.category === 'pre' || w.category === 'pre-watch'))
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setWatchLoading(false) })
  }, [])

  const loadData = useCallback(() => { refreshPositions(); loadWatchlist() }, [refreshPositions, loadWatchlist])

  useEffect(() => { loadWatchlist() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useChatRefresh(['trades', 'watchlist'], loadData)

  const alertPositionsKey = useMemo(
    () => positions.filter(p => p.sl || p.tp).map(p => `${p.id}:${p.sl}:${p.tp}`).sort().join(','),
    [positions]
  )

  useEffect(() => {
    const withAlerts = positions.filter(p => p.sl || p.tp)
    if (!withAlerts.length) { setAlertPositions([]); return }
    let cancelled = false
    const symbols = [...new Set(withAlerts.map(p => p.symbol))]
    getBatchPrices(symbols)
      .then(res => {
        if (cancelled) return
        const priceMap = res.data?.prices || {}
        // Store latest prices for P&L calculation in position cards
        const prices = {}
        symbols.forEach(s => { if (priceMap[s]?.price) prices[s] = parseFloat(priceMap[s].price) })
        setLatestPrices(prices)
        const alerts = withAlerts.reduce((acc, p) => {
          const price = parseFloat(priceMap[p.symbol]?.price || 0)
          if (!price) return acc
          const found = []
          if (p.sl) {
            const slV = parseFloat(p.sl)
            if (Math.abs((price - slV) / slV) <= ALERT_PCT_THRESHOLD) found.push({ type: 'SL', label: 'Near SL', threshold: slV })
          }
          if (p.tp) {
            const tpV = parseFloat(p.tp)
            if (Math.abs((price - tpV) / tpV) <= ALERT_PCT_THRESHOLD) found.push({ type: 'TP', label: 'Near TP', threshold: tpV })
          }
          if (found.length) acc.push({ ...p, _latestPrice: price, _alerts: found })
          return acc
        }, [])
        setAlertPositions(alerts)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [alertPositionsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const canTrade = !isIndex()

  useEffect(() => {
    if (!editWatchItem) return
    const fn = (e) => { if (e.key === 'Escape') setEditWatchItem(null) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [editWatchItem])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Edit watchlist modal */}
      {editWatchItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditWatchItem(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden animate-modal-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Edit Watchlist</p>
                <p className="text-[10px] text-gray-400" translate="no">{editWatchItem.symbol}</p>
              </div>
              <button onClick={() => setEditWatchItem(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-[16px]">×</button>
            </div>
            <EditWatchItemForm item={editWatchItem} onClose={() => setEditWatchItem(null)} onSaved={() => { setEditWatchItem(null); loadWatchlist() }} />
          </div>
        </div>,
        document.body
      )}

      {/* ── Top: Portfolio / Watchlist ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Tab bar */}
        <div className="flex gap-1 px-2 pt-2 pb-1.5 shrink-0">
          <div className="flex gap-1 flex-1 bg-white/30 dark:bg-white/[0.05] backdrop-blur-sm rounded-xl p-0.5 border border-white/20 dark:border-white/[0.06]">
          {[['portfolio', 'Portfolio', positions.length], ['watchlist', 'Watchlist', watchlist.length]].map(([key, label, count]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                tab === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
              }`}>
              {label}
              {count > 0 && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${
                  tab === key
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>{count}</span>
              )}
            </button>
          ))}
          </div>
        </div>

        {/* Portfolio tab */}
        {tab === 'portfolio' && (
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1.5 pb-2 animate-fade-up">
            {positionsLoading ? (
              <div className="space-y-1.5 pt-1">
                {[1,2].map(i => (
                  <div key={i} className="rounded-xl border border-gray-100 dark:border-white/8 bg-white/40 dark:bg-white/5 px-3 py-3 animate-pulse">
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-1/2 mb-2" />
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
                  </div>
                ))}
              </div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                  <span className="text-[14px]">📊</span>
                </div>
                <p className="text-[10px] text-gray-400">No open positions</p>
              </div>
            ) : positions.map((p, i) => (
              <PositionCard
                key={p.id}
                p={p}
                index={i}
                selected={selectedSymbol === p.symbol}
                onSelect={selectSymbol}
                latestPrice={latestPrices[p.symbol]}
              />
            ))}
          </div>
        )}

        {/* Watchlist tab */}
        {tab === 'watchlist' && (
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1.5 pb-2 animate-fade-up">
            {watchLoading ? (
              <div className="space-y-1.5 pt-1">
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-xl border border-gray-100 dark:border-white/8 bg-white/40 dark:bg-white/5 px-3 py-2.5 animate-pulse">
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-2/3 mb-1.5" />
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
                  </div>
                ))}
              </div>
            ) : watchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                  <span className="text-[14px]">👁</span>
                </div>
                <p className="text-[10px] text-gray-400">No watchlist stocks</p>
              </div>
            ) : watchlist.map(w => {
              if (pendingDelete === w.id) return (
                <div key={w.id} className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/15 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-2 text-center">
                    Remove <span translate="no">{w.symbol}</span>?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      className="flex-1 py-1.5 text-[10px] font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      onClick={async () => {
                        try {
                          await removeFromWatchlist(w.id)
                          clearWatchlistCache()
                          setWatchlist(prev => prev.filter(x => x.id !== w.id))
                          setWatchErr(null)
                        } catch {
                          setWatchErr('Failed to remove — please try again')
                        } finally {
                          setPendingDelete(null)
                        }
                      }}
                    >Remove</button>
                    <button
                      className="flex-1 py-1.5 text-[10px] font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => setPendingDelete(null)}
                    >Cancel</button>
                  </div>
                </div>
              )

              return (
                <WatchlistCard
                  key={w.id}
                  w={w}
                  selected={selectedSymbol === w.symbol}
                  onSelect={selectSymbol}
                  onEdit={setEditWatchItem}
                  onDelete={setPendingDelete}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-2 shrink-0" />

      {/* ── Bottom: BUY/SELL + Alerts ────────────────────────────────────── */}
      <div className="shrink-0 px-2 py-2 space-y-2 animate-fade-up">

        {/* BUY / SELL */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => canTrade && setTradeModal('BUY')}
            disabled={!canTrade}
            title={!canTrade ? 'Not available for indexes' : ''}
            className={`py-3.5 rounded-xl text-[12px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${
              canTrade
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/30 dark:shadow-emerald-900/50 active:scale-95 active:shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-400 cursor-not-allowed'
            }`}>
            <span className="text-[16px] leading-none">↑</span>
            <span>BUY</span>
          </button>
          <button
            onClick={() => canTrade && setTradeModal('SELL')}
            disabled={!canTrade}
            title={!canTrade ? 'Not available for indexes' : ''}
            className={`py-3.5 rounded-xl text-[12px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${
              canTrade
                ? 'bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500 text-white shadow-lg shadow-red-500/30 dark:shadow-red-900/50 active:scale-95 active:shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-400 cursor-not-allowed'
            }`}>
            <span className="text-[16px] leading-none">↓</span>
            <span>SELL</span>
          </button>
        </div>

        {/* Watchlist error */}
        {watchErr && (
          <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1">
            <p className="text-[10px] text-red-600 dark:text-red-300">{watchErr}</p>
            <button onClick={() => setWatchErr(null)} className="text-red-400 text-[10px] leading-none">×</button>
          </div>
        )}

        {/* SL/TP Alerts */}
        {alertPositions.length > 0 && (
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {alertPositions.map((p) => (
              <div key={p.id} className="rounded-xl border border-orange-200 dark:border-orange-700/70 bg-orange-50 dark:bg-orange-950/25 px-2.5 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    <button onClick={() => selectSymbol(p.symbol, null, p)}
                      className="text-[10px] font-bold text-gray-800 dark:text-gray-100 hover:text-orange-500 transition-colors" translate="no">
                      {p.symbol}
                    </button>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setCloseTarget(p) }}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/40 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors">
                    Close
                  </button>
                </div>
                {p._alerts.map((a, j) => (
                  <p key={j} className={`text-[9px] font-semibold ${a.type === 'SL' ? 'text-red-500' : 'text-emerald-500'}`}>
                    ⚡ {a.label} · {a.threshold?.toLocaleString()}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals — portalled to body to escape backdrop-blur stacking context ── */}
      {tradeModal && createPortal(
        <TradeModal
          side={tradeModal}
          symbol={selectedSymbol}
          onClose={() => setTradeModal(null)}
          onSaved={() => loadData()}
        />,
        document.body
      )}
      {closeTarget && createPortal(
        <CloseConfirm
          position={closeTarget}
          onClose={() => setCloseTarget(null)}
          onDone={() => loadData()}
        />,
        document.body
      )}
    </div>
  )
}
