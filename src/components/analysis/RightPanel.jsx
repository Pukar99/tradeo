import { useState, useEffect } from 'react'
import axios from 'axios'
import { getTopVolume } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

function MoverTable({ title, items, color, selectSymbol }) {
  if (!items?.length) return null
  return (
    <div>
      <p className={`text-[9px] font-semibold uppercase tracking-widest mb-1.5 ${color}`}>{title}</p>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[8px] text-gray-400 pb-1">Symbol</th>
            <th className="text-right text-[8px] text-gray-400 pb-1">Price</th>
            <th className="text-right text-[8px] text-gray-400 pb-1">Chg%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {items.slice(0, 7).map((s, i) => (
            <tr
              key={i}
              onClick={() => selectSymbol(s.s)}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-1 text-[10px] font-semibold text-gray-800 dark:text-gray-100">{s.s}</td>
              <td className="py-1 text-right text-[10px] text-gray-500 dark:text-gray-400">{s.c?.toLocaleString()}</td>
              <td className="py-1 text-right">
                <span className={`text-[9px] font-semibold ${parseFloat(s.p) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {parseFloat(s.p) >= 0 ? '+' : ''}{s.p}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RightPanel() {
  const { selectSymbol } = useAnalysis()
  const [movers, setMovers]   = useState(null)
  const [volume, setVolume]   = useState(null)
  const [dates, setDates]     = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate]     = useState('')

  useEffect(() => {
    axios.get('http://localhost:5000/api/market/dates')
      .then(r => {
        setDates(r.data.dates)
        setLatestDate(r.data.latestDate)
        setSelectedDate(r.data.latestDate)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    axios.get(`http://localhost:5000/api/market/top-movers?date=${selectedDate}`)
      .then(r => setMovers(r.data))
      .catch(() => {})
    getTopVolume({ limit: 7 })
      .then(r => setVolume(r.data))
      .catch(() => {})
  }, [selectedDate])

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">

      {/* Date selector */}
      <div className="flex items-center gap-2">
        <select
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none"
        >
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          onClick={() => setSelectedDate(latestDate)}
          className="text-[9px] font-semibold text-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-2 py-1.5 rounded-lg"
        >
          Latest
        </button>
      </div>

      {/* Gainers */}
      <MoverTable title="Top Gainers" items={movers?.gainers} color="text-emerald-500" selectSymbol={selectSymbol} />

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Losers */}
      <MoverTable title="Top Losers" items={movers?.losers} color="text-red-400" selectSymbol={selectSymbol} />

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Volume */}
      {volume?.data?.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-blue-400 mb-1.5">Top Volume</p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[8px] text-gray-400 pb-1">Symbol</th>
                <th className="text-right text-[8px] text-gray-400 pb-1">Turnover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {volume.data.map((s, i) => (
                <tr
                  key={i}
                  onClick={() => selectSymbol(s.s)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-1 text-[10px] font-semibold text-gray-800 dark:text-gray-100">{s.s}</td>
                  <td className="py-1 text-right text-[10px] text-gray-500 dark:text-gray-400">
                    {(s.t / 1e6).toFixed(1)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {movers && (
        <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-auto">{movers.total} stocks · {selectedDate}</p>
      )}
    </div>
  )
}
