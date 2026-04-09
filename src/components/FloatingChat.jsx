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
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 h-[480px] bg-gray-950 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden flex flex-col mb-2">
          <AIChat
            isFullPage={false}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      <button
        onClick={handleClick}
        className={`w-12 h-12 rounded-xl shadow-xl flex items-center justify-center transition-all duration-200 border ${
          isOpen
            ? 'bg-gray-900 border-gray-700 hover:bg-gray-800'
            : 'bg-gray-950 border-gray-800 hover:border-gray-600 hover:scale-105'
        }`}
      >
        {isOpen ? (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-black">T</span>
          </div>
        )}
      </button>
    </div>
  )
}

export default FloatingChat