import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TradeLog from '../components/trader/TradeLog'
import TradingJournal from '../components/trader/TradingJournal'

function TraderPage() {
  const [activeTab, setActiveTab] = useState('trades')
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-gray-500 mb-4">Please login to access Trader's Screen</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Trader's Screen
      </h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'trades'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Trade Log
        </button>
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'journal'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Journal
        </button>
      </div>

      {activeTab === 'trades' && <TradeLog />}
      {activeTab === 'journal' && <TradingJournal />}
    </div>
  )
}

export default TraderPage