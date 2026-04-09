import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NAV_LINKS = [
  { path: '/', label: 'Home' },
  { path: '/analysis', label: 'Analysis' },
  { path: '/trader', label: 'Trader' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/research', label: 'Research' },
]

function Navbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <nav className="bg-gray-950 border-b border-gray-800 px-6 py-0 flex justify-between items-center sticky top-0 z-40">

      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 py-4">
          <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-black">T</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Tradeo
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                isActive(link.path)
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {link.label}
              {isActive(link.path) && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t-full" />
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center overflow-hidden">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {getInitials(user.name)}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white">
                {user.name.split(' ')[0]}
              </span>
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm font-medium text-white">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {user.email}
                  </p>
                </div>

                <div className="p-1">
                  <Link
                    to="/"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <span>🏠</span> Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <span>👤</span> Profile
                  </Link>
                  <Link
                    to="/trader"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <span>📈</span> Trade Log
                  </Link>
                  <Link
                    to="/portfolio"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <span>💼</span> Portfolio
                  </Link>
                </div>

                <div className="p-1 border-t border-gray-700">
                  <button
                    onClick={() => { logout(); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="text-sm bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar