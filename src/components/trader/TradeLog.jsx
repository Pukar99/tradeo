import { useState, useEffect } from 'react'
import { getTrades, addTrade, deleteTrade, getTradeSummary } from '../../api'

function TradeLog() {
  const [trades, setTrades] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    symbol: '',
    type: 'BUY',
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const [tradesRes, summaryRes] = await Promise.all([
        getTrades(),
        getTradeSummary()
      ])
      setTrades(tradesRes.data)
      setSummary(summaryRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await addTrade({
        symbol: form.symbol.toUpperCase(),
        type: form.type,
        quantity: parseInt(form.quantity),
        price: parseFloat(form.price),
        date: form.date,
        notes: form.notes
      })
      setForm({
        symbol: '',
        type: 'BUY',
        quantity: '',
        price: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      })
      setShowForm(false)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add trade')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trade?')) return
    try {
      await deleteTrade(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return (
    <p className="text-gray-400 text-sm">Loading trades...</p>
  )

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalTrades}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Trades</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">
              {summary.totalBuys}
            </p>
            <p className="text-xs text-gray-500 mt-1">Buy Orders</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-500">
              {summary.totalSells}
            </p>
            <p className="text-xs text-gray-500 mt-1">Sell Orders</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">
              {summary.totalInvested.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Invested (Rs)</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Trade Log</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ Add Trade'}
          </button>
        </div>

        {showForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Record New Trade
            </h3>
            {error && (
              <div className="bg-red-50 text-red-600 p-2 rounded text-sm mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={e => setForm({
                      ...form,
                      symbol: e.target.value.toUpperCase()
                    })}
                    placeholder="NABIL"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    placeholder="10"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Price (Rs)
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="1200"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Total (Rs)
                  </label>
                  <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600">
                    {form.quantity && form.price
                      ? (parseInt(form.quantity) * parseFloat(form.price)).toLocaleString()
                      : '—'
                    }
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Why did you make this trade?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Trade'}
              </button>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          {trades.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm">No trades yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Click "+ Add Trade" to record your first trade
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Symbol</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr
                    key={trade.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {trade.date}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {trade.symbol}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.type === 'BUY'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {trade.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      Rs. {trade.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      Rs. {trade.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-32 truncate">
                      {trade.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(trade.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradeLog