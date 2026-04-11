import { useState } from 'react'
import AIChat from './AIChat'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/chat') return null
  if (!user) return null

  const handleClick = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="absolute bottom-0 right-0 w-80 h-[480px] bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
          <AIChat
            isFullPage={false}
            onClose={() => setIsOpen(false)}
          />
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="w-12 h-12 rounded-xl shadow-xl flex items-center justify-center transition-all duration-200 border bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-gray-600 hover:scale-105"
        >
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1"/>
            <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e"/>
            <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
            <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5"/>
            <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444"/>
            <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5"/>
            <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5"/>
            <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e"/>
            <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5"/>
            <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default FloatingChat