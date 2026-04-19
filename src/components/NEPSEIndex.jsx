import { useState, useEffect } from 'react'
import axios from 'axios'
import { BASE_URL } from '../api'

function NEPSEIndex() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${BASE_URL}/api/market/nepse-chart?range=1m`)
      .then(res => {
        const chartData = res.data.data
        if (chartData.length > 0) {
          const last = chartData[chartData.length - 1]
          const prev = chartData[chartData.length - 2]
          const change = prev
            ? ((last.close - prev.close) / prev.close * 100).toFixed(2)
            : '0.00'
          setData({
            close: last.close,
            change,
            date: last.time
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm w-52">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  )

  const isPositive = parseFloat(data?.change) >= 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm w-52">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        NEPSE Index
      </h3>
      <h1 className={`text-3xl font-bold mt-1 ${
        isPositive ? 'text-green-500' : 'text-red-500'
      }`}>
        {data?.close?.toFixed(2) || '—'}
      </h1>
      <p className={`text-sm font-medium mt-1 ${
        isPositive ? 'text-green-500' : 'text-red-500'
      }`}>
        {isPositive ? '+' : ''}{data?.change}% last day
      </p>
      <p className="text-xs text-gray-400 mt-1">
        As of {data?.date}
      </p>
    </div>
  )
}

export default NEPSEIndex