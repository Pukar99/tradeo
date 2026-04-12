import { useState, useEffect } from 'react'
import axios from 'axios'

function TopMovers() {
  const [data, setData] = useState(null)
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('http://localhost:5000/api/market/dates')
      .then(res => {
        setDates(res.data.dates)
        setLatestDate(res.data.latestDate)
        setSelectedDate(res.data.latestDate)
      })
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    axios.get(`http://localhost:5000/api/market/top-movers?date=${selectedDate}`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
  }, [selectedDate])

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] text-gray-400">{data.total} stocks · {selectedDate}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-700 dark:text-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
          >
            {dates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={() => setSelectedDate(latestDate)}
            className="text-[10px] font-semibold text-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-2.5 py-1.5 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            Latest
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2">
              {[1,2,3,4,5].map(j => (
                <div key={j} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Gainers */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-500 mb-2">Top Gainers</p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Symbol</th>
                  <th className="text-right text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Price</th>
                  <th className="text-right text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Chg%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {data?.gainers.map((stock, i) => (
                  <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-1.5 text-[11px] font-semibold text-gray-800 dark:text-gray-100">{stock.s}</td>
                    <td className="py-1.5 text-right text-[11px] text-gray-500 dark:text-gray-400">{stock.c.toLocaleString()}</td>
                    <td className="py-1.5 text-right">
                      <span className="text-[10px] font-semibold text-emerald-500">+{stock.p}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Losers */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-red-400 mb-2">Top Losers</p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Symbol</th>
                  <th className="text-right text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Price</th>
                  <th className="text-right text-[9px] font-semibold uppercase tracking-wider text-gray-400 pb-1.5">Chg%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {data?.losers.map((stock, i) => (
                  <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-1.5 text-[11px] font-semibold text-gray-800 dark:text-gray-100">{stock.s}</td>
                    <td className="py-1.5 text-right text-[11px] text-gray-500 dark:text-gray-400">{stock.c.toLocaleString()}</td>
                    <td className="py-1.5 text-right">
                      <span className="text-[10px] font-semibold text-red-400">{stock.p}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TopMovers
