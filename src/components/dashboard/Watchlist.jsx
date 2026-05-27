// === Watchlist.jsx ===
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  getWatchlist,
  addToWatchlist,
  updateWatchlist,
  removeFromWatchlist,
  getMarketSymbols,
} from '../../api'
import { getBatchPrices } from '../../utils/globalCache'
import { useContextMenu } from '../ContextMenu'
import { useChatRefresh } from '../../utils/chatEvents'

// ── Classification ────────────────────────────────────────────────────────────
// Returns { category: 'active'|'pre', status: null|'grace'|'expired' }
// Rules:
//   price signal  — ACTIVE if |ltp - alert| / ltp ≤ 15%, else PRE, else NEUTRAL
//   date signal   — ACTIVE if 0–14 days left or in grace (overdue ≤10 days)
//                   PRE if >14 days left
//                   EXPIRED if overdue >10 days
//   EXPIRED locks to PRE regardless of price signal
//   Either ACTIVE signal → category = active
//   Both NEUTRAL → category = pre (default)

function classifyItem(item, today) {
  const ltp = item.currentPrice

  let priceSignal = 'neutral'
  if (item.price_alert && ltp) {
    const pct = Math.abs((ltp - parseFloat(item.price_alert)) / ltp) * 100
    priceSignal = pct <= 15 ? 'active' : 'pre'
  }

  let dateSignal = 'neutral'
  let status = null
  if (item.alert_date) {
    const alertDate = new Date(item.alert_date + 'T00:00:00')
    const days = Math.ceil((alertDate - today) / (1000 * 60 * 60 * 24))
    if (days >= 0 && days <= 14) {
      dateSignal = 'active'
    } else if (days > 14) {
      dateSignal = 'pre'
    } else if (days >= -10) {
      dateSignal = 'active'
      status = 'grace'
    } else {
      dateSignal = 'expired'
      status = 'expired'
    }
  }

  if (dateSignal === 'expired') return { category: 'pre', status: 'expired' }
  if (priceSignal === 'active' || dateSignal === 'active') return { category: 'active', status }
  return { category: 'pre', status }
}

// ── Alert messages ────────────────────────────────────────────────────────────
function getAlertMessages(item, today) {
  const msgs = []
  const ltp = item.currentPrice
  if (!ltp) return msgs

  if (item.price_alert) {
    const alert = parseFloat(item.price_alert)
    const diff  = alert - ltp
    const pct   = Math.abs((diff / ltp) * 100).toFixed(1)
    if (Math.abs(diff) < ltp * 0.02) {
      msgs.push({ text: 'Near alert level', color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' })
    } else if (diff > 0) {
      msgs.push({ text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' })
    } else {
      msgs.push({ text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' })
    }
  }

  if (item.watch_low && ltp) {
    const wl   = parseFloat(item.watch_low)
    const diff = ltp - wl
    const pct  = Math.abs((diff / ltp) * 100).toFixed(1)
    if (diff > 0) {
      msgs.push({ text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch low`, color: 'text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' })
    } else {
      msgs.push({ text: 'Below watch low', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' })
    }
  }

  if (item.watch_high && ltp) {
    const wh   = parseFloat(item.watch_high)
    const diff = wh - ltp
    const pct  = Math.abs((diff / ltp) * 100).toFixed(1)
    if (diff > 0) {
      msgs.push({ text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch high`, color: 'text-green-500 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' })
    } else {
      msgs.push({ text: 'Above watch high', color: 'text-green-500 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' })
    }
  }

  if (item.alert_date) {
    const alertDate = new Date(item.alert_date + 'T00:00:00')
    const days = Math.ceil((alertDate - today) / (1000 * 60 * 60 * 24))
    if (days < -10) {
      msgs.push({ text: `Alert expired ${Math.abs(days)} days ago`, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' })
    } else if (days < 0) {
      msgs.push({ text: `${Math.abs(days)}d overdue — grace period`, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' })
    } else if (days === 0) {
      msgs.push({ text: 'Alert date is today', color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' })
    } else if (days <= 3) {
      msgs.push({ text: `${days}d left`, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' })
    } else if (days <= 14) {
      msgs.push({ text: `${days}d left`, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' })
    }
  }

  return msgs
}

// ── Price proximity bar (0–100% fill based on distance to alert) ──────────────
function PriceBar({ item }) {
  if (!item.price_alert || !item.currentPrice) return null
  const ltp   = item.currentPrice
  const alert = parseFloat(item.price_alert)
  const pct   = Math.abs((ltp - alert) / ltp) * 100
  const fill  = Math.max(0, Math.min(100, 100 - pct / 15 * 100))
  return (
    <div className="mt-1.5 h-1 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-400 dark:bg-blue-500 transition-all"
        style={{ width: `${fill}%` }}
      />
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-2 px-4 py-6 animate-pulse">
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditWatchlistModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    watch_low:   item.watch_low   != null ? String(item.watch_low)   : '',
    watch_high:  item.watch_high  != null ? String(item.watch_high)  : '',
    price_alert: item.price_alert != null ? String(item.price_alert) : '',
    alert_date:  item.alert_date  ? item.alert_date.slice(0, 10) : '',
    notes:       item.notes       || '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      await updateWatchlist(item.id, {
        watch_low:   form.watch_low   !== '' ? parseFloat(form.watch_low)   : null,
        watch_high:  form.watch_high  !== '' ? parseFloat(form.watch_high)  : null,
        price_alert: form.price_alert !== '' ? parseFloat(form.price_alert) : null,
        alert_date:  form.alert_date  || null,
        notes:       form.notes       || null,
      })
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const FIELDS = [
    ['Watch Low (Rs)',  'watch_low',   'number'],
    ['Watch High (Rs)', 'watch_high',  'number'],
    ['Price Alert (Rs)','price_alert', 'number'],
    ['Alert Date',      'alert_date',  'date'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Edit</p>
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mt-0.5" translate="no">{item.symbol}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-lg">×</button>
        </div>
        <form onSubmit={handleSave} className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              maxLength={300}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Why are you watching this?"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
            />
          </div>
          {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-[12px] font-bold transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Symbol search with auto-suggest ──────────────────────────────────────────
function SymbolSearch({ symbolList, onSelected, onCancel }) {
  const [query,    setQuery]    = useState('')
  const [cursor,   setCursor]   = useState(-1)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    return symbolList
      .filter(s => s.symbol.startsWith(q) || s.company_name?.toUpperCase().includes(q))
      .slice(0, 8)
  }, [query, symbolList])

  const select = (sym) => {
    onSelected(sym)
  }

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (cursor >= 0 && suggestions[cursor]) select(suggestions[cursor])
      else if (suggestions.length === 1) select(suggestions[0])
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
      <div className="relative">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 h-7">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setCursor(-1) }}
            onKeyDown={handleKey}
            placeholder="Type symbol…"
            className="flex-1 bg-transparent text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
            translate="no"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs leading-none">×</button>
          )}
        </div>

        {suggestions.length > 0 && (
          <div
            ref={listRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={s.symbol}
                onClick={() => select(s)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                  i === cursor
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${i < suggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-900 dark:text-white" translate="no">{s.symbol}</p>
                  {s.company_name && (
                    <p className="text-[10px] text-gray-400 truncate">{s.company_name}</p>
                  )}
                </div>
                {s.price != null && (
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">Rs.{s.price.toLocaleString()}</p>
                    {s.change != null && (
                      <p className={`text-[10px] font-medium ${s.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {s.change >= 0 ? '+' : ''}{s.change}%
                      </p>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onCancel}
        className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        Cancel
      </button>
    </div>
  )
}

// ── Add form (shown after symbol selected) ────────────────────────────────────
const EMPTY_FORM = { watch_low: '', watch_high: '', price_alert: '', alert_date: '', notes: '' }

function AddForm({ symbol, refPrice, onAdd, onCancel }) {
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [err,    setErr]    = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAdding(true); setErr(null)
    try {
      await onAdd({
        symbol,
        watch_low:   form.watch_low   ? parseFloat(form.watch_low)   : null,
        watch_high:  form.watch_high  ? parseFloat(form.watch_high)  : null,
        price_alert: form.price_alert ? parseFloat(form.price_alert) : null,
        alert_date:  form.alert_date  || null,
        notes:       form.notes       || null,
      })
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to add')
      setAdding(false)
    }
  }

  const priceAlertPct = form.price_alert && refPrice
    ? ((parseFloat(form.price_alert) - refPrice) / refPrice * 100).toFixed(1)
    : null
  const alertDays = form.alert_date
    ? Math.ceil((new Date(form.alert_date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100" translate="no">{symbol}</p>
          {refPrice && (
            <p className="text-[11px] text-gray-400">Rs.{refPrice.toLocaleString()}</p>
          )}
        </div>
        <button onClick={onCancel} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Price Alert (Rs)', 'price_alert', 'number'],
            ['Alert Date',       'alert_date',  'date'],
            ['Watch Low (Rs)',   'watch_low',   'number'],
            ['Watch High (Rs)',  'watch_high',  'number'],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
              />
              {key === 'price_alert' && priceAlertPct && (
                <p className={`text-[10px] mt-0.5 ${parseFloat(priceAlertPct) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {parseFloat(priceAlertPct) >= 0 ? '+' : ''}{priceAlertPct}% from LTP
                </p>
              )}
              {key === 'alert_date' && alertDays != null && (
                <p className="text-[10px] mt-0.5 text-blue-500 dark:text-blue-400">{alertDays}d from today</p>
              )}
            </div>
          ))}
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            maxLength={300}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Why watching?"
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
          />
        </div>

        {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-2.5 py-1.5 rounded-lg">{err}</p>}

        <button
          type="submit"
          disabled={adding}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-[11px] font-bold transition-colors"
        >
          {adding ? 'Adding…' : 'Add to Watchlist'}
        </button>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
function Watchlist() {
  const [watchlist,   setWatchlist]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fetchErr,    setFetchErr]    = useState(null)
  const [activeTab,   setActiveTab]   = useState('active')
  const [editItem,    setEditItem]    = useState(null)

  // add flow: null | 'search' | { symbol, refPrice }
  const [addState,    setAddState]    = useState(null)

  // symbol list for autocomplete — loaded once, stored in ref to avoid re-renders
  const symbolListRef = useRef([])
  const [symbolsReady, setSymbolsReady] = useState(false)

  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  // ── Fetch watchlist ─────────────────────────────────────────────────────────
  const fetchWatchlist = useCallback(async () => {
    setFetchErr(null)
    try {
      const watchRes = await getWatchlist()
      const watchItems = (watchRes.data || []).filter(w => w.category !== 'portfolio')

      const symbols = [...new Set(watchItems.map(w => w.symbol))].filter(Boolean)
      let priceMap = {}
      if (symbols.length > 0) {
        try {
          const batchRes = await getBatchPrices(symbols)
          priceMap = batchRes.data.prices || {}
        } catch { /* prices unavailable — UI still works */ }
      }

      setWatchlist(watchItems.map(w => {
        const p = priceMap[w.symbol]
        return { ...w, currentPrice: p?.price ?? null, change: p?.change ?? null }
      }))
    } catch {
      setFetchErr('Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])
  useChatRefresh(['watchlist'], fetchWatchlist)

  // ── Load symbol list for autocomplete ──────────────────────────────────────
  useEffect(() => {
    getMarketSymbols()
      .then(res => {
        symbolListRef.current = res.data || []
        setSymbolsReady(true)
      })
      .catch(() => setSymbolsReady(true)) // proceed even if symbols fail
  }, [])

  // ── Classify items ─────────────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const classified = useMemo(
    () => watchlist.map(w => ({ ...w, ...classifyItem(w, today) })),
    [watchlist, today.toDateString()] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const activeItems = classified.filter(w => w.category === 'active')
  const preItems    = classified.filter(w => w.category === 'pre')
  const filtered    = activeTab === 'active' ? activeItems : preItems

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSymbolSelected = (sym) => {
    setAddState({ symbol: sym.symbol, refPrice: sym.price ?? null })
  }

  const handleAdd = async (data) => {
    await addToWatchlist(data)
    setAddState(null)
    await fetchWatchlist()
  }

  const handleRemove = async (id) => {
    const snapshot = watchlist.find(w => w.id === id)
    setWatchlist(prev => prev.filter(w => w.id !== id))
    try {
      await removeFromWatchlist(id)
    } catch {
      if (snapshot) setWatchlist(prev => [...prev, snapshot])
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
      <Skeleton />
    </div>
  )

  if (fetchErr) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col items-center gap-3 min-h-[80px] justify-center">
      <p className="text-[11px] text-red-400">{fetchErr}</p>
      <button onClick={fetchWatchlist} className="text-[11px] px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
        Retry
      </button>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <ContextMenuPortal />
      {editItem && (
        <EditWatchlistModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); fetchWatchlist() }}
        />
      )}

      {/* ── Header row: label + tabs + add button ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">Watchlist</p>

        <div className="flex-1" />

        {/* Tab pill group */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
          {[
            { id: 'active', label: `Active${activeItems.length ? ` ${activeItems.length}` : ''}` },
            { id: 'pre',    label: `Pre-Watch${preItems.length ? ` ${preItems.length}` : ''}` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setAddState(null) }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        {addState === null && (
          <button
            onClick={() => setAddState('search')}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* ── Symbol search ── */}
      {addState === 'search' && symbolsReady && (
        <SymbolSearch
          symbolList={symbolListRef.current}
          onSelected={handleSymbolSelected}
          onCancel={() => setAddState(null)}
        />
      )}
      {addState === 'search' && !symbolsReady && (
        <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
          Loading symbols…
        </div>
      )}

      {/* ── Add form ── */}
      {addState && typeof addState === 'object' && (
        <AddForm
          symbol={addState.symbol}
          refPrice={addState.refPrice}
          onAdd={handleAdd}
          onCancel={() => setAddState(null)}
        />
      )}

      {/* ── List ── */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[11px] text-gray-400">No stocks in {activeTab === 'active' ? 'Active' : 'Pre-Watch'}</p>
            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
              {activeTab === 'active'
                ? 'Items auto-promote when alert is within 15% or 2 weeks'
                : 'Click + to add a symbol'}
            </p>
          </div>
        ) : (
          filtered.map((item, i) => {
            const alertMsgs = getAlertMessages(item, today)
            const isExpired = item.status === 'expired'
            const inGrace   = item.status === 'grace'

            return (
              <div
                key={item.id}
                onContextMenu={onContextMenu([
                  { label: 'Edit',   icon: '✏️', action: () => setEditItem(item) },
                  { separator: true },
                  { label: 'Delete', icon: '🗑️', danger: true, action: () => handleRemove(item.id) },
                ])}
                className={`px-3 py-2.5 cursor-default transition-colors ${
                  i % 2 === 1
                    ? 'bg-gray-50/80 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                    : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60'
                } ${isExpired ? 'opacity-60' : ''}`}
              >
                {/* Top row: symbol + badges + price */}
                <div className="flex items-start justify-between gap-2" translate="no">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-[12px] font-bold ${isExpired ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                        {item.symbol}
                      </p>
                      {isExpired && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold uppercase tracking-wide">
                          Expired
                        </span>
                      )}
                      {inGrace && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">
                          Grace
                        </span>
                      )}
                    </div>

                    {/* Sub-details */}
                    <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5">
                      {(item.watch_low || item.watch_high) && (
                        <p>Range: Rs.{item.watch_low ?? '—'} – Rs.{item.watch_high ?? '—'}</p>
                      )}
                      {item.price_alert && (
                        <p>Alert: Rs.{parseFloat(item.price_alert).toLocaleString()}</p>
                      )}
                      {item.alert_date && (
                        <p className={isExpired ? 'line-through' : ''}>
                          By: {new Date(item.alert_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-gray-400 dark:text-gray-500 italic truncate max-w-[160px]">"{item.notes}"</p>
                      )}
                    </div>
                  </div>

                  {/* Price + change */}
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-semibold tabular-nums text-gray-900 dark:text-white">
                      {item.currentPrice != null ? `Rs.${item.currentPrice.toLocaleString()}` : '—'}
                    </p>
                    {item.change != null && (
                      <p className={`text-[10px] font-medium tabular-nums ${item.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Price proximity bar (active tab only, when price_alert set) */}
                {activeTab === 'active' && <PriceBar item={item} />}

                {/* Alert messages */}
                {alertMsgs.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {alertMsgs.map((msg, j) => (
                      <div key={j} className={`${msg.bg} px-2 py-1 rounded-lg`}>
                        <p className={`text-[10px] font-medium ${msg.color}`}>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Watchlist
