import { useState, useEffect } from 'react'
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getStockPrice,
  getTradeLog
} from '../../api'

const CATEGORIES = [
  { value: 'active', label: '⭐ Active' },
  { value: 'pre', label: '🟡 Pre-Watch' },
  { value: 'portfolio', label: '📁 Portfolio' },
]

function Watchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    symbol: '',
    watch_low: '',
    watch_high: '',
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

      setWatchlist([
        ...watchRes.data.filter(w => w.category !== 'portfolio'),
        ...portfolioWithPrices
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWatchlist() }, [])

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
        category: form.category
      })
      setForm({ symbol: '', watch_low: '', watch_high: '', category: 'active' })
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

      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Watchlist
          </h2>
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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stockInfo.symbol}</p>
                  <p className="text-xs text-gray-400">Data as of {stockInfo.latestDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Rs. {stockInfo.price.toLocaleString()}
                  </p>
                  <p className={`text-xs font-medium ${stockInfo.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stockInfo.change >= 0 ? '+' : ''}{stockInfo.change}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {stockInfo && (
            <form onSubmit={handleAdd}>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Watch Low (Rs)</label>
                  <input
                    type="number"
                    value={form.watch_low}
                    onChange={e => setForm({ ...form, watch_low: e.target.value })}
                    placeholder="e.g. 450"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Watch High (Rs)</label>
                  <input
                    type="number"
                    value={form.watch_high}
                    onChange={e => setForm({ ...form, watch_high: e.target.value })}
                    placeholder="e.g. 550"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Category</label>
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
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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

            return (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 group"
              >
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
                    (item.watch_low || item.watch_high) && (
                      <p className="text-xs text-gray-400">
                        Rs.{item.watch_low || '—'} – Rs.{item.watch_high || '—'}
                      </p>
                    )
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {item.isPortfolio && (
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
                  )}
                  {!item.isPortfolio && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
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