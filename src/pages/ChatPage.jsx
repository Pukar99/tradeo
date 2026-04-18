import AIChat from '../components/AIChat'
import TraderProfile from '../components/TraderProfile'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

function ChatPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center max-w-md shadow-sm">
          <span className="text-4xl mb-4 block">🤖</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Tradeo AI
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Login to chat with your AI trading assistant
          </p>
          <Link
            to="/login"
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            Login to Access
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-4 h-[calc(100vh-80px)]">

        {/* Left — Trader Profile sidebar */}
        <div className="hidden lg:flex flex-col w-72 flex-shrink-0 gap-4 overflow-y-auto pb-2">
          <div>
            <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-0.5">AI Trading Assistant</h2>
            <p className="text-[10px] text-gray-400">Powered by Groq · NEPSE-aware</p>
          </div>
          <TraderProfile />
        </div>

        {/* Right — Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header (hidden on lg) */}
          <div className="lg:hidden mb-4">
            <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">AI Trading Assistant</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Powered by Groq · Knows your portfolio, NEPSE data & verified research</p>
          </div>
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <AIChat isFullPage={true} />
          </div>
        </div>

      </div>
    </div>
  )
}

export default ChatPage
