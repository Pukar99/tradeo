import { useAuth } from '../context/AuthContext'
import TaskBoard from '../components/dashboard/TaskBoard'
import DisciplineScore from '../components/dashboard/DisciplineScore'
import PerformanceDashboard from '../components/dashboard/PerformanceDashboard'
import Watchlist from '../components/dashboard/Watchlist'
import MonthlyGoals from '../components/dashboard/MonthlyGoals'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'

const MOTIVATIONAL_QUOTES = [
  "The market is a device for transferring money from the impatient to the patient.",
  "Risk comes from not knowing what you are doing.",
  "In investing, what is comfortable is rarely profitable.",
  "The stock market is filled with individuals who know the price of everything but the value of nothing.",
  "Trade what you see, not what you think.",
  "Cut losses short, let profits run.",
  "Plan the trade, trade the plan.",
  "Discipline is the bridge between trading goals and trading reality.",
]

function LoggedOutHome() {
  const quote = MOTIVATIONAL_QUOTES[
    Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
  ]
  const [topGainers, setTopGainers] = useState([])

  useEffect(() => {
    axios.get('http://localhost:5000/api/market/top-movers')
      .then(res => setTopGainers(res.data.gainers?.slice(0, 5) || []))
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Welcome to Tradeo
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-6">
          Your professional NEPSE trading workspace
        </p>
        <Link
          to="/signup"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 mr-3"
        >
          Get Started Free
        </Link>
        <Link
          to="/login"
          className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50"
        >
          Login
        </Link>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900 rounded-xl p-6 mb-6 text-center">
        <p className="text-blue-800 dark:text-blue-200 italic text-sm font-medium">
          "{quote}"
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Today's Top Gainers
          </h3>
          {topGainers.length > 0 ? (
            <div className="space-y-2">
              {topGainers.map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {s.s}
                  </span>
                  <span className="text-sm text-green-500 font-medium">
                    +{s.p}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Performance Preview
          </h3>
          <div className="space-y-3 filter blur-sm select-none pointer-events-none">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Total P&L</span>
              <span className="text-sm font-bold text-green-500">
                +Rs. 12,450
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Win Rate</span>
              <span className="text-sm font-bold text-blue-500">68%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Total Trades</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                24
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Streak</span>
              <span className="text-sm font-bold text-orange-500">
                🔥 5 days
              </span>
            </div>
          </div>
          <p className="text-xs text-center text-gray-400 mt-3">
            Login to see your real data
          </p>
        </div>
      </div>
    </div>
  )
}

function LoggedInHome() {
  const { user } = useAuth()

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{today}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2" style={{ height: '420px' }}>
          <TaskBoard compact={true} />
        </div>
        <div style={{ height: '420px' }}>
          <DisciplineScore />
        </div>
      </div>

      <div className="mb-4">
        <PerformanceDashboard />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <Watchlist />
        </div>
        <div>
          <MonthlyGoals />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/trader"
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-lg">
            📈
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600">
              Add NEPSE Journal Entry
            </p>
            <p className="text-xs text-gray-400">
              Record today's NEPSE thoughts
            </p>
          </div>
        </Link>
        <Link
          to="/trader"
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center text-lg">
            💹
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600">
              Add Forex Journal Entry
            </p>
            <p className="text-xs text-gray-400">
              Record today's Forex thoughts
            </p>
          </div>
        </Link>
      </div>

    </div>
  )
}

function HomePage() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      {user ? <LoggedInHome /> : <LoggedOutHome />}
    </div>
  )
}

export default HomePage