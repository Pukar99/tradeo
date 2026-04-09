import AIChat from '../components/AIChat'
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
    <div className="w-full h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Trading Assistant
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Powered by Groq · Knows your portfolio, NEPSE data & verified research
          </p>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <AIChat isFullPage={true} />
        </div>
      </div>
    </div>
  )
}

export default ChatPage