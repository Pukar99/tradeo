// === ChatPage.jsx — maximized AI chat: edge-to-edge, sticky header, sidebar always open ===
import AIChat from '../components/AIChat'
import TraderProfile from '../components/TraderProfile'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

function ChatPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center max-w-md border border-gray-100 dark:border-gray-800">
          <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tradeo AI</h2>
          <p className="text-gray-400 text-sm mb-6">Login to chat with your AI trading assistant</p>
          <Link
            to="/login"
            className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors"
          >
            Login to Access
          </Link>
        </div>
      </div>
    )
  }

  return (
    // Edge-to-edge: no max-width cap, fills full viewport height minus the navbar.
    // 56px mobile navbar / 64px desktop — kept as data-comment; update if Navbar height changes.
    <div className="bg-gray-100 dark:bg-gray-950 h-[calc(100dvh-56px)] sm:h-[calc(100dvh-64px)] flex gap-3 p-3 sm:p-4">

      {/* ── Left sidebar: Trader Profile (desktop only, always open) ── */}
      <aside className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 min-h-0 overflow-y-auto gap-3">
        {/* Sidebar header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3">
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">AI Trading Assistant</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Powered by Groq · NEPSE-aware</p>
        </div>
        {/* TraderProfile — opened by default in ChatPage (full profile always visible) */}
        <TraderProfile defaultOpen />
      </aside>

      {/* ── Right: chat panel, fills remaining space, never overflows ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile page label (hidden lg+, the chat header already says "Tradeo AI") */}
        <div className="lg:hidden mb-2 px-1">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">AI Trading Assistant</p>
          <p className="text-[10px] text-gray-400">Powered by Groq · NEPSE-aware</p>
        </div>
        {/* Chat container: rounded card, strict height so only the message list scrolls */}
        <div className="flex-1 min-h-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
          <AIChat isFullPage={true} />
        </div>
      </div>
    </div>
  )
}

export default ChatPage
