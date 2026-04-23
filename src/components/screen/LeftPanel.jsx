import { useState, useEffect, useCallback } from 'react'
import { getTradeLog, getWatchlist, removeFromWatchlist, updateWatchlist, addTradeLog, closeTradeLog, getBatchPrices } from '../../api'
import { useContextMenu } from '../ContextMenu'
import { useChatRefresh } from '../../utils/chatEvents'
import { useScreen } from '../../context/ScreenContext'

// ── BUY / SELL Modal ──────────────────────────────────────────────────────────

function TradeModal({ side, symbol, onClose, onSaved }) {
  const [form, setForm] = useState({ entry_price: '', sl: '', tp: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const isBuy = side === 'BUY'
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.entry_price || !form.quantity) { setErr('Entry price and quantity are required'); return }
    setSaving(true); setErr(null)
    try {
      await addTradeLog({
        symbol,
        position:    isBuy ? 'LONG' : 'SHORT',
        entry_price: parseFloat(form.entry_price),
        sl:          form.sl       ? parseFloat(form.sl)       : null,
        tp:          form.tp       ? parseFloat(form.tp)       : null,
        quantity:    parseInt(form.quantity),
        notes:       form.notes || null,
        entry_date:  new Date().toISOString().slice(0, 10),
        status:      'OPEN',
      })
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save trade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden">

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 ${isBuy ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-white">{isBuy ? 'BUY' : 'SELL'}</span>
            <span className="text-[11px] font-semibold text-white/80">{symbol}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <span className="text-white text-[14px] leading-none">×</span>
          </button>
        </div>

        {/* Form */}
        <div className="px-4 py-4 space-y-3">
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
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
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
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
            />
          </div>

          {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">{err}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition-colors ${
              isBuy
                ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300'
                : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
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

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const handleClose = async () => {
    setSaving(true); setErr(null)
    try {
      const latestClose = position._latestPrice || position.entry_price
      await closeTradeLog(position.id, { exit_price: latestClose, exit_date: new Date().toISOString().slice(0, 10) })
      onDone()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to close position')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xs z-10 p-5 text-center">
        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mb-1">Close Position?</p>
        <p className="text-[11px] text-gray-500 mb-4">
          {position.symbol} · {position.position} · Qty {position.remaining_quantity ?? position.quantity}
        </p>
        {err && <p className="text-[11px] text-red-500 mb-3">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleClose} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold transition-colors disabled:opacity-50">
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
      onSaved()
    } catch (err) {
      setSaveErr(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800'

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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeftPanel() {
  const { selectedSymbol, selectSymbol, isIndex } = useScreen()
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [tab,       setTab]       = useState('portfolio')
  const [watchErr,  setWatchErr]  = useState(null)

  // Modal state
  const [tradeModal,     setTradeModal]     = useState(null)
  const [closeTarget,    setCloseTarget]    = useState(null)
  const [alertPositions, setAlertPositions] = useState([])
  const [editWatchItem,  setEditWatchItem]  = useState(null)

  const loadData = useCallback(() => {
    Promise.all([getTradeLog(), getWatchlist()])
      .then(([tradeRes, watchRes]) => {
        setPositions((tradeRes.data || []).filter(t => t.status === 'OPEN' || t.status === 'PARTIAL'))
        setWatchlist((watchRes.data || []).filter(w => w.category === 'active' || w.category === 'pre' || w.category === 'pre-watch'))
      })
      .catch(() => {})
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useChatRefresh(['trades', 'watchlist'], loadData)

  // Within 2% of SL or TP — single batch request instead of N individual calls
  useEffect(() => {
    const withAlerts = positions.filter(p => p.sl || p.tp)
    if (!withAlerts.length) { setAlertPositions([]); return }
    let cancelled = false
    const symbols = [...new Set(withAlerts.map(p => p.symbol))]
    getBatchPrices(symbols)
      .then(res => {
        if (cancelled) return
        const priceMap = res.data?.prices || {}
        const alerts = withAlerts.reduce((acc, p) => {
          const price = parseFloat(priceMap[p.symbol]?.price || 0)
          if (!price) return acc
          const found = []
          if (p.sl) {
            const slV = parseFloat(p.sl)
            if (Math.abs((price - slV) / slV * 100) <= 2) found.push({ type: 'SL', label: 'Near SL', threshold: slV })
          }
          if (p.tp) {
            const tpV = parseFloat(p.tp)
            if (Math.abs((price - tpV) / tpV * 100) <= 2) found.push({ type: 'TP', label: 'Near TP', threshold: tpV })
          }
          if (found.length) acc.push({ ...p, _latestPrice: price, _alerts: found })
          return acc
        }, [])
        setAlertPositions(alerts)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [positions])

  const canTrade = !isIndex()
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  // Escape key closes edit watchlist modal
  useEffect(() => {
    if (!editWatchItem) return
    const fn = (e) => { if (e.key === 'Escape') setEditWatchItem(null) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [editWatchItem])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ContextMenuPortal />

      {/* Edit watchlist modal */}
      {editWatchItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditWatchItem(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Edit Watchlist</p>
                <p className="text-[10px] text-gray-400" translate="no">{editWatchItem.symbol}</p>
              </div>
              <button onClick={() => setEditWatchItem(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-[16px]">×</button>
            </div>
            <EditWatchItemForm item={editWatchItem} onClose={() => setEditWatchItem(null)} onSaved={() => { setEditWatchItem(null); loadData() }} />
          </div>
        </div>
      )}

      {/* ── Top half: Portfolio / Watchlist ──────────────────────────── */}
      <div className="h-1/2 flex flex-col min-h-0 border-b border-gray-100 dark:border-gray-800">

        {/* Tab bar */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 m-2 shrink-0">
          {[['portfolio', 'P'], ['watchlist', 'W']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-colors relative ${
                tab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}>
              {label}
              {key === 'portfolio' && positions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Portfolio */}
        {tab === 'portfolio' && (
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
            {positions.length === 0 ? (
              <p className="text-center text-[9px] text-gray-400 py-4">No open positions</p>
            ) : positions.map(p => (
              <div key={p.id} onClick={() => selectSymbol(p.symbol, null, p)}
                className={`cursor-pointer rounded-xl px-2 py-2 transition-all border ${
                  selectedSymbol === p.symbol
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
                }`}>
                <div className="flex items-center justify-between mb-1" translate="no">
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{p.symbol}</span>
                  <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                    p.position === 'LONG' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-red-100 dark:bg-red-950 text-red-500'
                  }`}>{p.position}</span>
                </div>
                <div className="text-[8px] text-gray-500 space-y-0.5" translate="no">
                  <div>Qty: <span className="text-gray-700 dark:text-gray-300 font-medium">{p.remaining_quantity ?? p.quantity}</span></div>
                  <div>Entry: <span className="text-blue-400 font-medium">{parseFloat(p.entry_price)?.toLocaleString()}</span></div>
                  {p.sl && <div>SL: <span className="text-red-400 font-medium">{parseFloat(p.sl).toLocaleString()}</span></div>}
                  {p.tp && <div>TP: <span className="text-emerald-500 font-medium">{parseFloat(p.tp).toLocaleString()}</span></div>}
                </div>
                {p.sl && p.tp && (
                  <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-400 via-gray-300 dark:via-gray-600 to-emerald-400 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Watchlist */}
        {tab === 'watchlist' && (
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
            {watchlist.length === 0 ? (
              <p className="text-center text-[9px] text-gray-400 py-4">No watchlist stocks</p>
            ) : watchlist.map(w => (
              <div key={w.id}
                onClick={() => selectSymbol(w.symbol)}
                onContextMenu={onContextMenu([
                  { label: 'Edit', icon: '✏️', action: () => setEditWatchItem(w) },
                  { separator: true },
                  { label: 'Delete', icon: '🗑️', danger: true, action: async () => {
                    try {
                      await removeFromWatchlist(w.id)
                      setWatchlist(prev => prev.filter(x => x.id !== w.id))
                      setWatchErr(null)
                    } catch {
                      setWatchErr('Failed to remove from watchlist')
                    }
                  }},
                ])}
                className={`cursor-pointer rounded-xl px-2 py-2 transition-all border ${
                  selectedSymbol === w.symbol
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
                }`}>
                <div className="flex items-center justify-between" translate="no">
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{w.symbol}</span>
                  <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded-md ${
                    (w.category === 'pre' || w.category === 'pre-watch')
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  }`}>{(w.category === 'pre' || w.category === 'pre-watch') ? 'Pre' : 'Active'}</span>
                </div>
                {(w.watch_low || w.watch_high) && (
                  <div className="flex gap-2 mt-0.5 text-[7px] text-gray-400">
                    {w.watch_low  && <span>L: <span className="text-red-400">{w.watch_low}</span></span>}
                    {w.watch_high && <span>H: <span className="text-emerald-500">{w.watch_high}</span></span>}
                  </div>
                )}
                {w.notes && <p className="text-[7px] text-gray-400 mt-0.5 truncate">{w.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom half: BUY/SELL + Alerts ──────────────────────────── */}
      <div className="h-1/2 flex flex-col gap-2 px-2 py-3 min-h-0">

        {/* BUY / SELL */}
        <div className="grid grid-cols-2 gap-1 shrink-0">
          <button
            onClick={() => canTrade && setTradeModal('BUY')}
            disabled={!canTrade}
            title={!canTrade ? 'Not available for indexes' : ''}
            className={`py-2 rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
              canTrade
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}>
            BUY
          </button>
          <button
            onClick={() => canTrade && setTradeModal('SELL')}
            disabled={!canTrade}
            title={!canTrade ? 'Not available for indexes' : ''}
            className={`py-2 rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
              canTrade
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}>
            SELL
          </button>
        </div>

        {/* Watchlist error */}
        {watchErr && (
          <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1 shrink-0">
            <p className="text-[8px] text-red-500">{watchErr}</p>
            <button onClick={() => setWatchErr(null)} className="text-red-400 text-[10px] leading-none">×</button>
          </div>
        )}

        {/* SL/TP Alerts */}
        {alertPositions.length > 0 ? (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5">
            {alertPositions.map((p, i) => (
              <div key={i} className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 px-2 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <button onClick={() => selectSymbol(p.symbol, null, p)}
                    className="text-[10px] font-bold text-gray-800 dark:text-gray-100 hover:text-blue-500 transition-colors">
                    {p.symbol}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setCloseTarget(p) }}
                    className="text-[7px] font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-500 hover:bg-red-200 dark:hover:bg-red-900 transition-colors">
                    Close
                  </button>
                </div>
                {p._alerts.map((a, j) => (
                  <p key={j} className={`text-[8px] font-medium ${a.type === 'SL' ? 'text-red-500' : 'text-emerald-500'}`}>
                    → {a.label} ({a.threshold?.toLocaleString()})
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[8px] text-gray-300 dark:text-gray-700 mt-auto">No SL/TP alerts</p>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {tradeModal && (
        <TradeModal
          side={tradeModal}
          symbol={selectedSymbol}
          onClose={() => setTradeModal(null)}
          onSaved={() => loadData()}
        />
      )}
      {closeTarget && (
        <CloseConfirm
          position={closeTarget}
          onClose={() => setCloseTarget(null)}
          onDone={() => loadData()}
        />
      )}

    </div>
  )
}
