import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

function TradeoLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  )
}

// Safe initials — handles null, empty, extra whitespace
function getInitials(name) {
  if (!name || !name.trim()) return '?'
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function Navbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  // ── Google Translate cookie toggle ─────────────────────────────────────────
  const getCookieLang = () => {
    try {
      const match = document.cookie.match(/googtrans=\/en\/(\w+)/)
      return match ? match[1] : 'en'
    } catch {
      return 'en'
    }
  }

  const [isNepali, setIsNepali] = useState(() => getCookieLang() === 'ne')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const dropdownRef = useRef(null)

  const setGoogTransCookie = (lang) => {
    const value = lang === 'en' ? '/en/en' : '/en/ne'
    // Include max-age so the preference persists across sessions (1 year)
    const maxAge = 'max-age=31536000; SameSite=Lax'
    document.cookie = `googtrans=${value}; path=/; ${maxAge}`
    document.cookie = `googtrans=${value}; domain=${window.location.hostname}; path=/; ${maxAge}`
  }

  const toggleGoogleTranslate = () => {
    if (isNepali) {
      setGoogTransCookie('en')
      setIsNepali(false)
    } else {
      setGoogTransCookie('ne')
      setIsNepali(true)
    }
    window.location.reload()
  }

  // ── Nav links ───────────────────────────────────────────────────────────────
  const NAV_LINKS = [
    { path: '/', label: t('nav.home') },
    { path: '/screen', label: t('nav.analysis') },
    { path: '/logs', label: t('nav.trader') },
    { path: '/portfolio', label: t('nav.portfolio') },
    { path: '/research', label: t('nav.research') },
    { path: '/risklab', label: t('nav.risklab') },
  ]

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Close dropdown + mobile menu on Escape ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Close mobile menu + dropdown when route changes ─────────────────────────
  useEffect(() => {
    setDropdownOpen(false)
    setMobileMenuOpen(false)
  }, [location.pathname])

  // ── Reset avatar error when user avatar_url changes ─────────────────────────
  useEffect(() => {
    setAvatarError(false)
  }, [user?.avatar_url])

  const isActive = useCallback((path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }, [location.pathname])

  const handleLogout = () => {
    setDropdownOpen(false)
    setMobileMenuOpen(false)
    logout()
    navigate('/login')
  }

  const displayName = user?.name?.trim() || user?.email || 'User'
  const firstName = displayName.split(/\s+/)[0]

  return (
    <nav className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6 py-0 flex justify-between items-center sticky top-0 z-40 shadow-sm">

      {/* ── Left: Logo + Desktop nav links ─────────────────────────────────── */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 py-3 flex-shrink-0">
          <TradeoLogo />
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
            Tradeo
          </span>
        </Link>

        {/* Desktop nav — hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                isActive(link.path)
                  ? 'text-green-600 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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

      {/* ── Right: Controls ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Language toggle */}
        <button
          onClick={toggleGoogleTranslate}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isNepali ? 'Switch to English' : 'नेपालीमा हेर्नुस्'}
          aria-label={isNepali ? 'Switch to English' : 'Switch to Nepali'}
        >
          <span>{isNepali ? '🇬🇧' : '🇳🇵'}</span>
          <span className="hidden sm:inline">{isNepali ? 'EN' : 'नेपाली'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
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
          /* ── User profile dropdown ─────────────────────────────────────── */
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              aria-label="Open user menu"
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user.avatar_url && !avatarError ? (
                  <img
                    src={user.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="text-white text-xs font-bold">{getInitials(user.name)}</span>
                )}
              </div>
              <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white font-medium">
                {firstName}
              </span>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                </div>
                <div className="p-1">
                  {[
                    { to: '/', icon: '🏠', label: t('nav.dashboard') },
                    { to: '/profile', icon: '👤', label: t('nav.profile') },
                    { to: '/chat', icon: '🤖', label: t('nav.aiChat') },
                    { to: '/logs', icon: '📈', label: t('nav.tradeLog') },
                    { to: '/portfolio', icon: '💼', label: t('nav.portfolio') },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <span>{item.icon}</span> {item.label}
                    </Link>
                  ))}
                </div>
                <div className="p-1 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('nav.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Guest: Login / Signup ──────────────────────────────────────── */
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              {t('nav.login')}
            </Link>
            <Link
              to="/signup"
              className="text-sm bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        )}

        {/* ── Mobile hamburger — only on small screens ───────────────────── */}
        <button
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile menu drawer ──────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-lg z-40">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
