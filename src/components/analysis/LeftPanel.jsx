import { useState, useEffect } from 'react'
import { getTradeLog, getWatchlist, removeFromWatchlist, getTodayTasks, addTradeLog, closeTradeLog, getStockPrice } from '../../api'
import { useContextMenu } from '../ContextMenu'
import { useAnalysis } from '../../context/AnalysisContext'

// ── BUY / SELL Modal ──────────────────────────────────────────────────────────

function TradeModal({ side, symbol, onClose, onSaved }) {
  const [form, setForm] = useState({ entry_price: '', sl: '', tp: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

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

  const handleClose = async () => {
    setSaving(true)
    try {
      const latestClose = position._latestPrice || position.entry_price
      await closeTradeLog(position.id, { exit_price: latestClose, exit_date: new Date().toISOString().slice(0, 10) })
      onDone()
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xs z-10 p-5 text-center">
        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mb-1">Close Position?</p>
        <p className="text-[11px] text-gray-500 mb-4">
          {position.symbol} · {position.position} · Qty {position.remaining_quantity ?? position.quantity}
        </p>
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeftPanel() {
  const { selectedSymbol, selectSymbol, isIndex } = useAnalysis()
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [tasks,     setTasks]     = useState([])
  const [tab,       setTab]       = useState('portfolio')

  // Modal state
  const [tradeModal,    setTradeModal]    = useState(null)
  const [closeTarget,   setCloseTarget]   = useState(null)
  const [alertPositions, setAlertPositions] = useState([])

  const loadData = () => {
    getTradeLog()
      .then(r => setPositions((r.data || []).filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')))
      .catch(() => {})
    getWatchlist()
      .then(r => setWatchlist((r.data || []).filter(w => w.category === 'active' || w.category === 'pre' || w.category === 'pre-watch')))
      .catch(() => {})
    getTodayTasks()
      .then(r => {
        const fixed  = (r.data.fixedTasks || []).map(t => ({ ...t, label: t.title || t.label || t.id }))
        const custom = r.data.customTasks || []
        setTasks([...fixed, ...custom])
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
    // Refetch when user returns to this tab (e.g. after deleting from Dashboard)
    const onFocus = () => loadData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Within 2% of SL or TP
  useEffect(() => {
    if (!positions.length) { setAlertPositions([]); return }
    let cancelled = false
    Promise.all(
      positions.filter(p => p.sl || p.tp).map(async p => {
        try {
          const r = await getStockPrice(p.symbol)
          const price = parseFloat(r.data?.close || r.data?.price || 0)
          if (!price) return null
          const alerts = []
          if (p.sl) {
            const slV = parseFloat(p.sl)
            if (Math.abs((price - slV) / slV * 100) <= 2) alerts.push({ type: 'SL', label: 'Near SL', threshold: slV })
          }
          if (p.tp) {
            const tpV = parseFloat(p.tp)
            if (Math.abs((price - tpV) / tpV * 100) <= 2) alerts.push({ type: 'TP', label: 'Near TP', threshold: tpV })
          }
          return alerts.length ? { ...p, _latestPrice: price, _alerts: alerts } : null
        } catch { return null }
      })
    ).then(res => { if (!cancelled) setAlertPositions(res.filter(Boolean)) })
    return () => { cancelled = true }
  }, [positions])

  const completedTasks = tasks.filter(t => t.completed).length
  const canTrade       = !isIndex(selectedSymbol)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ContextMenuPortal />

      {/* ── P / W tabs ────────────────────────────────────────────────── */}
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

      {/* ── Portfolio ────────────────────────────────────────────────── */}
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
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{p.symbol}</span>
                <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                  p.position === 'LONG' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-red-100 dark:bg-red-950 text-red-500'
                }`}>{p.position}</span>
              </div>
              <div className="text-[8px] text-gray-500 space-y-0.5">
                <div>Qty: <span className="text-gray-700 dark:text-gray-300 font-medium">{p.remaining_quantity ?? p.quantity}</span></div>
                <div>Entry: <span className="text-blue-400 font-medium">{p.entry_price?.toLocaleString()}</span></div>
                {p.sl && <div>SL: <span className="text-red-400 font-medium">{p.sl}</span></div>}
                {p.tp && <div>TP: <span className="text-emerald-500 font-medium">{p.tp}</span></div>}
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

      {/* ── Watchlist ─────────────────────────────────────────────────── */}
      {tab === 'watchlist' && (
        <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
          {watchlist.length === 0 ? (
            <p className="text-center text-[9px] text-gray-400 py-4">No watchlist stocks</p>
          ) : watchlist.map(w => (
            <div key={w.id}
              onClick={() => selectSymbol(w.symbol)}
              onContextMenu={onContextMenu([
                { label: 'Delete', icon: '🗑️', danger: true, action: () =>
                    removeFromWatchlist(w.id).then(() => setWatchlist(prev => prev.filter(x => x.id !== w.id)))
                },
              ])}
              className={`cursor-pointer rounded-xl px-2 py-2 transition-all border ${
                selectedSymbol === w.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
              }`}>
              <div className="flex items-center justify-between">
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

      {/* ── Today's Plan + BUY/SELL ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 pt-2 pb-1 mt-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Today's Plan</span>
          <span className="text-[8px] text-gray-400">{completedTasks}/{tasks.length}</span>
        </div>
        {tasks.length > 0 && (
          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 mb-2 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${tasks.length ? (completedTasks / tasks.length) * 100 : 0}%` }} />
          </div>
        )}

        {/* BUY / SELL — disabled for index */}
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => canTrade && setTradeModal('BUY')}
            disabled={!canTrade}
            title={!canTrade ? 'Not available for indexes' : ''}
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
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
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
              canTrade
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}>
            SELL
          </button>
        </div>

        {/* ── Alerts: within 2% of SL or TP ── */}
        {alertPositions.length > 0 && (
          <div className="mt-2 space-y-1.5">
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
