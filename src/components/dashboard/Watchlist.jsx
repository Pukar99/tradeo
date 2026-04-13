import { useState, useEffect } from 'react'
import {
  getWatchlist,
  addToWatchlist,
  updateWatchlist,
  removeFromWatchlist,
  getStockPrice,
  getTradeLog
} from '../../api'
import { useContextMenu } from '../ContextMenu'
import { useChatRefresh } from '../../utils/chatEvents'

function EditWatchlistModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    watch_low:   item.watch_low   || '',
    watch_high:  item.watch_high  || '',
    price_alert: item.price_alert || '',
    alert_date:  item.alert_date  ? item.alert_date.slice(0, 10) : '',
    notes:       item.notes       || '',
    category:    item.category    || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

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
        category:    form.category,
      })
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm z-10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Edit Watchlist</p>
            <p className="text-[10px] text-gray-400" translate="no">{item.symbol}</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-[16px]">×</button>
        </div>
        <form onSubmit={handleSave} className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Watch Low (Rs)', 'watch_low', 'number'],
              ['Watch High (Rs)', 'watch_high', 'number'],
              ['Price Alert (Rs)', 'price_alert', 'number'],
              ['Alert Date', 'alert_date', 'date'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
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
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Why are you watching this?"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-800"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-300"
            >
              {CATEGORIES.filter(c => c.value !== 'portfolio').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-3 py-1.5 rounded-lg">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-[12px] font-bold transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

const CATEGORIES = [
  { value: 'active', label: '⭐ Active' },
  { value: 'pre', label: '🟡 Pre-Watch' },
  { value: 'portfolio', label: '📁 Portfolio' },
]

function getAlertMessage(item) {
  const messages = []
  const ltp = item.currentPrice

  if (!ltp) return []

  // Price alert message
  if (item.price_alert) {
    const diff = item.price_alert - ltp
    const pct = Math.abs((diff / ltp) * 100).toFixed(2)
    if (Math.abs(diff) < ltp * 0.02) {
      messages.push({ text: '🎯 Near your alert level!', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
    } else if (diff > 0) {
      messages.push({ text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) rally needed to hit alert`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' })
    } else {
      messages.push({ text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) drop needed to hit alert`, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900' })
    }
  }

  // Watch low/high messages
  if (item.watch_low && ltp) {
    const diff = ltp - item.watch_low
    const pct = Math.abs((diff / ltp) * 100).toFixed(2)
    if (diff > 0) {
      messages.push({ text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) drop to watch low`, color: 'text-red-400', bg: 'bg-red-50 dark:bg-red-900' })
    } else {
      messages.push({ text: '⚠️ Below watch low level!', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900' })
    }
  }

  if (item.watch_high && ltp) {
    const diff = item.watch_high - ltp
    const pct = Math.abs((diff / ltp) * 100).toFixed(2)
    if (diff > 0) {
      messages.push({ text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) rally to watch high`, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900' })
    } else {
      messages.push({ text: '🚀 Above watch high level!', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900' })
    }
  }

  // Date alert message
  if (item.alert_date) {
    const today = new Date()
    const alertDate = new Date(item.alert_date)
    const diffDays = Math.ceil((alertDate - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) {
      messages.push({ text: `⏰ Alert date passed ${Math.abs(diffDays)} days ago`, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700' })
    } else if (diffDays === 0) {
      messages.push({ text: '⏰ Alert date is today!', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
    } else if (diffDays <= 3) {
      messages.push({ text: `⏰ ${diffDays} day${diffDays !== 1 ? 's' : ''} remaining for alert date`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900' })
    } else {
      messages.push({ text: `📅 ${diffDays} days remaining for alert date`, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900' })
    }
  }

  return messages
}

function Watchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({
    symbol: '',
    watch_low: '',
    watch_high: '',
    price_alert: '',
    alert_date: '',
    notes: '',
    category: 'active'
  })
  const [searching, setSearching] = useState(false)
  const [stockInfo, setStockInfo] = useState(null)
  const [stockError, setStockError] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchWatchlist = async () => {
    try {
      const [watchRes, tradeLogRes] = await Promise.all([
        getWatchlist(),
        getTradeLog()
      ])

      const openTrades = tradeLogRes.data.filter(
        t => t.status === 'OPEN' || t.status === 'PARTIAL'
      )

      const portfolioWithPrices = await Promise.all(
        openTrades.map(async (t) => {
          try {
            const priceRes = await getStockPrice(t.symbol)
            const qty = t.remaining_quantity || t.quantity
            const ltp = priceRes.data.price
            const pnl = t.position === 'LONG'
              ? (ltp - t.entry_price) * qty
              : (t.entry_price - ltp) * qty
            return {
              id: `tradelog_${t.id}`,
              symbol: t.symbol,
              quantity: qty,
              avg_price: t.entry_price,
              currentPrice: ltp,
              change: priceRes.data.change,
              latestDate: priceRes.data.latestDate,
              position: t.position,
              status: t.status,
              sl: t.sl,
              tp: t.tp,
              pnl: Math.round(pnl),
              category: 'portfolio',
              isPortfolio: true
            }
          } catch {
            return {
              id: `tradelog_${t.id}`,
              symbol: t.symbol,
              quantity: t.remaining_quantity || t.quantity,
              avg_price: t.entry_price,
              currentPrice: null,
              position: t.position,
              status: t.status,
              sl: t.sl,
              tp: t.tp,
              pnl: null,
              category: 'portfolio',
              isPortfolio: true
            }
          }
        })
      )

      // Fetch prices for watchlist items
      const watchItems = watchRes.data.filter(w => w.category !== 'portfolio')
      const watchWithPrices = await Promise.all(
        watchItems.map(async (w) => {
          try {
            const priceRes = await getStockPrice(w.symbol)
            return { ...w, currentPrice: priceRes.data.price, change: priceRes.data.change }
          } catch {
            return { ...w, currentPrice: null }
          }
        })
      )

      setWatchlist([...watchWithPrices, ...portfolioWithPrices])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWatchlist() }, [])
  useChatRefresh(['watchlist', 'trades'], fetchWatchlist)

  const handleSymbolSearch = async () => {
    if (!form.symbol.trim()) return
    setSearching(true)
    setStockError('')
    setStockInfo(null)
    try {
      const res = await getStockPrice(form.symbol.trim())
      setStockInfo(res.data)
    } catch {
      setStockError(`${form.symbol.toUpperCase()} not found in NEPSE data`)
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!stockInfo) return
    setAdding(true)
    try {
      await addToWatchlist({
        symbol: form.symbol.toUpperCase(),
        watch_low: form.watch_low ? parseFloat(form.watch_low) : null,
        watch_high: form.watch_high ? parseFloat(form.watch_high) : null,
        price_alert: form.price_alert ? parseFloat(form.price_alert) : null,
        alert_date: form.alert_date || null,
        notes: form.notes || null,
        category: form.category
      })
      setForm({ symbol: '', watch_low: '', watch_high: '', price_alert: '', alert_date: '', notes: '', category: 'active' })
      setStockInfo(null)
      setShowForm(false)
      fetchWatchlist()
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    try {
      await removeFromWatchlist(id)
      setWatchlist(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = watchlist.filter(w => w.category === activeTab)

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-400">Loading watchlist...</p>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <ContextMenuPortal />
      {editItem && (
        <EditWatchlistModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); fetchWatchlist() }}
        />
      )}

      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Watchlist</h2>
          {activeTab !== 'portfolio' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setActiveTab(cat.value); setShowForm(false) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === cat.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {showForm && activeTab !== 'portfolio' && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={form.symbol}
              onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              placeholder="Symbol e.g. NABIL"
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleSymbolSearch()}
            />
            <button
              onClick={handleSymbolSearch}
              disabled={searching || !form.symbol.trim()}
              className="bg-gray-800 dark:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-40"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {stockError && <p className="text-xs text-red-500 mb-3">{stockError}</p>}

          {stockInfo && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 mb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stockInfo.symbol}</p>
                  <p className="text-xs text-gray-400">Data as of {stockInfo.latestDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Rs. {stockInfo.price.toLocaleString()}</p>
                  <p className={`text-xs font-medium ${stockInfo.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stockInfo.change >= 0 ? '+' : ''}{stockInfo.change}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {stockInfo && (
            <form onSubmit={handleAdd}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Watch Low (Rs) <span className="text-gray-400">optional</span>
                  </label>
                  <input
                    type="number"
                    value={form.watch_low}
                    onChange={e => setForm({ ...form, watch_low: e.target.value })}
                    placeholder="e.g. 450"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Watch High (Rs) <span className="text-gray-400">optional</span>
                  </label>
                  <input
                    type="number"
                    value={form.watch_high}
                    onChange={e => setForm({ ...form, watch_high: e.target.value })}
                    placeholder="e.g. 550"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    🎯 Price Alert (Rs) <span className="text-gray-400">optional</span>
                  </label>
                  <input
                    type="number"
                    value={form.price_alert}
                    onChange={e => setForm({ ...form, price_alert: e.target.value })}
                    placeholder={`e.g. ${stockInfo ? Math.round(stockInfo.price * 0.95) : '—'}`}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {form.price_alert && stockInfo && (
                    <p className={`text-xs mt-1 ${parseFloat(form.price_alert) > stockInfo.price ? 'text-green-500' : 'text-red-400'}`}>
                      {parseFloat(form.price_alert) > stockInfo.price
                        ? `+${((parseFloat(form.price_alert) - stockInfo.price) / stockInfo.price * 100).toFixed(2)}% rally needed`
                        : `${((parseFloat(form.price_alert) - stockInfo.price) / stockInfo.price * 100).toFixed(2)}% drop needed`
                      }
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    📅 Alert Date <span className="text-gray-400">optional</span>
                  </label>
                  <input
                    type="date"
                    value={form.alert_date}
                    onChange={e => setForm({ ...form, alert_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {form.alert_date && (
                    <p className="text-xs text-blue-500 mt-1">
                      {Math.ceil((new Date(form.alert_date) - new Date()) / (1000 * 60 * 60 * 24))} days from today
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Notes <span className="text-gray-400">optional</span>
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Why are you watching this stock?"
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.filter(c => c.value !== 'portfolio').map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={adding}
                className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add to Watchlist'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-400">
              {activeTab === 'portfolio' ? 'No open positions' : 'No stocks in this list'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === 'portfolio'
                ? 'Add trades in Trader screen to see open positions here'
                : 'Click "+ Add" to add stocks'
              }
            </p>
          </div>
        ) : (
          filtered.map(item => {
            const pnlPct = item.isPortfolio && item.currentPrice
              ? ((item.currentPrice - item.avg_price) / item.avg_price * 100).toFixed(2)
              : null
            const alertMessages = !item.isPortfolio ? getAlertMessage(item) : []

            return (
              <div
                key={item.id}
                onContextMenu={!item.isPortfolio ? onContextMenu([
                  { label: 'Edit', icon: '✏️', action: () => setEditItem(item) },
                  { separator: true },
                  { label: 'Delete', icon: '🗑️', danger: true, action: () => handleRemove(item.id) },
                ]) : undefined}
                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between" translate="no">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.symbol}
                      </p>
                      {item.isPortfolio && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          item.position === 'LONG'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {item.position}
                        </span>
                      )}
                      {item.status === 'PARTIAL' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 font-medium">
                          PARTIAL
                        </span>
                      )}
                    </div>

                    {item.isPortfolio ? (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.quantity} shares @ Rs.{item.avg_price}
                        {item.sl && <span className="text-red-400 ml-2">SL:{item.sl}</span>}
                        {item.tp && <span className="text-green-400 ml-2">TP:{item.tp}</span>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                        {(item.watch_low || item.watch_high) && (
                          <p>Range: Rs.{item.watch_low || '—'} – Rs.{item.watch_high || '—'}</p>
                        )}
                        {item.price_alert && (
                          <p>Alert: Rs.{item.price_alert}</p>
                        )}
                        {item.alert_date && (
                          <p>Watch by: {new Date(item.alert_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        )}
                        {item.notes && (
                          <p className="text-gray-500 italic truncate max-w-36">"{item.notes}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {item.isPortfolio ? (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Rs.{item.currentPrice?.toLocaleString() || '—'}
                        </p>
                        {item.pnl !== null && (
                          <p className={`text-xs font-medium ${item.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.pnl >= 0 ? '+' : ''}Rs.{Math.abs(item.pnl).toLocaleString()}
                            {pnlPct && ` (${pnlPct}%)`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Rs.{item.currentPrice?.toLocaleString() || '—'}
                        </p>
                        {item.change !== undefined && item.change !== null && (
                          <p className={`text-xs font-medium ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.change >= 0 ? '+' : ''}{item.change}%
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alert Messages */}
                {alertMessages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {alertMessages.map((msg, i) => (
                      <div key={i} className={`${msg.bg} px-2.5 py-1 rounded-lg`}>
                        <p className={`text-xs font-medium ${msg.color}`}>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {activeTab === 'portfolio' && filtered.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            Synced from Trade Log · Open positions only ·{' '}
            Prices as of {filtered.find(f => f.latestDate)?.latestDate || '—'}
          </p>
        </div>
      )}
    </div>
  )
}

export default Watchlist