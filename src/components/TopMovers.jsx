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

  const handleToday = () => setSelectedDate(latestDate)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mt-6">

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top Movers</h2>
          {data && (
            <p className="text-xs text-gray-400">
              {data.total} stocks traded on {selectedDate}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
            <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700 focus:outline-none focus:border-blue-500 max-w-36"
            >
            {dates.map(d => (
                <option key={d} value={d}>{d}</option>
            ))}
            </select>
          <button
            onClick={handleToday}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700"
          >
            Latest
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">

          <div>
            <h3 className="text-sm font-semibold text-green-600 mb-2">
              Top Gainers
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left py-1">Symbol</th>
                  <th className="text-right py-1">Price</th>
                  <th className="text-right py-1">Change</th>
                </tr>
              </thead>
              <tbody>
                {data?.gainers.map((stock, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1 font-medium text-gray-900">
                      {stock.s}
                    </td>
                    <td className="py-1 text-right text-gray-600">
                      {stock.c.toLocaleString()}
                    </td>
                    <td className="py-1 text-right text-green-500 font-medium">
                      +{stock.p}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-red-500 mb-2">
              Top Losers
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left py-1">Symbol</th>
                  <th className="text-right py-1">Price</th>
                  <th className="text-right py-1">Change</th>
                </tr>
              </thead>
              <tbody>
                {data?.losers.map((stock, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1 font-medium text-gray-900">
                      {stock.s}
                    </td>
                    <td className="py-1 text-right text-gray-600">
                      {stock.c.toLocaleString()}
                    </td>
                    <td className="py-1 text-right text-red-500 font-medium">
                      {stock.p}%
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