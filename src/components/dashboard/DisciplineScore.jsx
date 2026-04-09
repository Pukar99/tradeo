import { useState, useEffect } from 'react'
import { getDiscipline } from '../../api'

function DisciplineScore() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDiscipline()
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 50) return 'text-blue-500'
    if (score >= 30) return 'text-yellow-500'
    return 'text-red-400'
  }

  const getCircleStyle = (score) => {
    const circumference = 2 * Math.PI * 30
    const offset = circumference - (score / 100) * circumference
    return { strokeDasharray: circumference, strokeDashoffset: offset }
  }

  const getCircleColor = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 50) return '#3b82f6'
    if (score >= 30) return '#eab308'
    return '#f87171'
  }

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm h-full">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 h-full flex flex-col">

      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
        Discipline Score
      </h2>

      <div className="flex items-center justify-center mb-3">
        <div className="relative w-24 h-24">
          <svg
            className="w-24 h-24 transform -rotate-90"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40" cy="40" r="30"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="8"
            />
            <circle
              cx="40" cy="40" r="30"
              fill="none"
              stroke={getCircleColor(data?.monthlyScore || 0)}
              strokeWidth="8"
              strokeLinecap="round"
              style={getCircleStyle(data?.monthlyScore || 0)}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${getScoreColor(data?.monthlyScore || 0)}`}>
              {data?.monthlyScore || 0}%
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-4">
        Monthly Average
      </p>

      <div className="space-y-3 flex-1">
        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Today's Score
          </span>
          <span className={`text-sm font-bold ${getScoreColor(data?.todayScore || 0)}`}>
            {data?.todayScore || 0}%
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Streak
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {data?.streak > 0 ? `🔥 ${data.streak} days` : '—'}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Total Days Tracked
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {data?.logs?.length || 0}
          </span>
        </div>
      </div>

      {data?.impactTag && (
        <div className={`mt-4 p-3 rounded-lg text-xs text-center font-medium ${
          (data.todayScore || 0) >= 80
            ? 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300'
            : (data.todayScore || 0) <= 40
            ? 'bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300'
            : 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
        }`}>
          {data.impactTag}
        </div>
      )}

    </div>
  )
}

export default DisciplineScore