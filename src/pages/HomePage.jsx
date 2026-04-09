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
    <div className="w-full max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Professional NEPSE Trading Workspace
        </div>
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
          Trade Smarter.<br />
          <span className="text-green-500">Stay Disciplined.</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          Your all-in-one NEPSE trading workspace — charts, journal, portfolio, and discipline tracker.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/signup"
            className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Get Started Free →
          </Link>
          <Link
            to="/login"
            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Login
          </Link>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-8 text-center">
        <p className="text-white italic text-sm font-medium opacity-90">
          "{quote}"
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-500 text-lg">📈</span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Today's Top Gainers
            </h3>
          </div>
          {topGainers.length > 0 ? (
            <div className="space-y-2">
              {topGainers.map((s, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {s.s}
                  </span>
                  <span className="text-sm text-green-500 font-medium bg-green-50 dark:bg-green-900 px-2 py-0.5 rounded-full">
                    +{s.p}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between py-1">
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-blue-500 text-lg">💼</span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Performance Preview
            </h3>
          </div>
          <div className="space-y-3 filter blur-sm select-none pointer-events-none">
            <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total P&L</span>
              <span className="text-sm font-bold text-green-500">+Rs. 12,450</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Win Rate</span>
              <span className="text-sm font-bold text-blue-500">68%</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Trades</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">24</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">Streak</span>
              <span className="text-sm font-bold text-orange-500">🔥 5 days</span>
            </div>
          </div>
          <p className="text-xs text-center text-gray-400 mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
            🔒 Login to see your real data
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
    <div className="w-full px-6 py-6">

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Market data as of 2026-02-26</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="lg:col-span-3" style={{ height: '420px' }}>
          <TaskBoard compact={true} />
        </div>
        <div style={{ height: '420px' }}>
          <DisciplineScore />
        </div>
      </div>

      <div className="mb-4">
        <PerformanceDashboard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="lg:col-span-3">
          <Watchlist />
        </div>
        <div>
          <MonthlyGoals />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/trader"
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-800 border border-transparent group"
        >
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
            📈
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
              Add NEPSE Journal Entry
            </p>
            <p className="text-xs text-gray-400">
              Record today's NEPSE thoughts
            </p>
          </div>
          <span className="ml-auto text-gray-300 group-hover:text-blue-400 transition-colors">→</span>
        </Link>
        <Link
          to="/trader"
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:border-purple-200 dark:hover:border-purple-800 border border-transparent group"
        >
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
            💹
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
              Add Forex Journal Entry
            </p>
            <p className="text-xs text-gray-400">
              Record today's Forex thoughts
            </p>
          </div>
          <span className="ml-auto text-gray-300 group-hover:text-purple-400 transition-colors">→</span>
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