// =============================================================================
// Navbar.jsx — Top navigation bar
// =============================================================================
// Sections:
//   1. TradeoLogo  — SVG logo mark
//   2. Helpers     — getInitials
//   3. Navbar      — main component (auto-hide, dropdown, mobile menu)
// =============================================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications'

// =============================================================================
// 1. LOGO
// =============================================================================

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

// =============================================================================
// 2. HELPERS
// =============================================================================

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

// =============================================================================
// 3. NAVBAR
// =============================================================================

function Navbar({ autoHide = false, hidden = false, onMouseEnter, onMouseLeave }) {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, isNepali, toggleLang } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const dropdownRef = useRef(null)

  // Notification bell
  const [bellOpen,    setBellOpen]    = useState(false)
  const [notifs,      setNotifs]      = useState([])
  const [unread,      setUnread]      = useState(0)
  const bellRef    = useRef(null)
  const notifDirty = useRef(true)  // true = needs fetch

  // useMemo — t changes only on language toggle, not on every render
  const NAV_LINKS = useMemo(() => [
    { path: '/',          label: t('nav.home')      },
    { path: '/screen',    label: 'Screen'           },
    { path: '/logs',      label: 'Logs'             },
    { path: '/portfolio', label: t('nav.portfolio') },
    { path: '/datalab',   label: 'Data Lab'         },
    { path: '/explore',   label: 'Explore'          },
  ], [t])

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

  // ── Close dropdown + mobile menu + bell on Escape ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setMobileMenuOpen(false)
        setBellOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Close mobile menu + dropdown + bell when route changes ──────────────────
  useEffect(() => {
    setDropdownOpen(false)
    setMobileMenuOpen(false)
    setBellOpen(false)
  }, [location.pathname])

  // ── Close mobile menu when navbar slides away (auto-hide pages only) ────────
  useEffect(() => {
    if (hidden) setMobileMenuOpen(false)
  }, [hidden])

  // ── Reset avatar error when user avatar_url changes ─────────────────────────
  useEffect(() => {
    setAvatarError(false)
  }, [user?.avatar_url])

  // ── Notifications: fetch once on login, refetch when bell opens ──────────────
  const fetchNotifs = useCallback(async () => {
    if (!notifDirty.current) return
    notifDirty.current = false
    try {
      const { data } = await getNotifications()
      setNotifs(data.notifications || [])
      setUnread(data.unread || 0)
    } catch {
      // silent — bell just shows nothing
    }
  }, [])

  useEffect(() => {
    if (user) { notifDirty.current = true; fetchNotifs() }
    else       { setNotifs([]); setUnread(0) }
  }, [user, fetchNotifs])

  useEffect(() => {
    if (bellOpen) fetchNotifs()
  }, [bellOpen, fetchNotifs])

  // ── Close bell on outside click ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch { /* silent */ }
  }

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
    <nav
      className={[
        'glass-bar px-4 lg:px-6 py-0 flex justify-between items-center z-50',
        // When auto-hide is active: fixed + slide transition.
        // When normal: sticky (all other pages unchanged).
        autoHide
          ? 'fixed top-0 left-0 right-0 transition-transform duration-300 ease-in-out'
          : 'sticky top-0',
        autoHide && hidden ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
      onMouseEnter={autoHide ? onMouseEnter : undefined}
    >

      {/* ── Left: Logo + Desktop nav links ─────────────────────────────────── */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 py-3 flex-shrink-0">
          <TradeoLogo />
          <div className="flex items-baseline gap-2">
            <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
              Tradeo
            </span>
            <span
              className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold"
              title={`Tradeo v${import.meta.env.VITE_APP_VERSION}`}
            >
              v{import.meta.env.VITE_APP_VERSION}
            </span>
          </div>
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t-full animate-scale-x-in origin-left" />
              )}
            </Link>
          ))}
          {user?.is_admin && (
            <Link
              to="/admin"
              className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'text-green-600 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Admin
              {isActive('/admin') && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t-full animate-scale-x-in origin-left" />
              )}
            </Link>
          )}
        </div>
      </div>

      {/* ── Right: Controls ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 min-h-[44px] px-2.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isNepali ? 'Switch to English' : 'नेपालीमा हेर्नुस्'}
          aria-label={isNepali ? 'Switch to English' : 'Switch to Nepali'}
        >
          <span className="text-[13px]">{isNepali ? '🇬🇧' : '🇳🇵'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

        {/* Notification bell — only when logged in */}
        {user && (
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(prev => !prev)}
              aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
              className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-[60]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Notifications</p>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-green-600 dark:text-green-400 hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {/* Items */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
                  {notifs.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    notifs.map(n => (
                      <button
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          n.read
                            ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                            : 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0" style={n.read ? { paddingLeft: '14px' } : {}}>
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {user ? (
          /* ── User profile dropdown ─────────────────────────────────────── */
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              aria-label="Open user menu"
              className="flex items-center gap-2 px-2 min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
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
                className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-[60]"
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
          className={`lg:hidden w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
            mobileMenuOpen
              ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile menu drawer — slide-down on open ─────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60 shadow-xl z-50 animate-slide-down">
          {/* green accent bar at top */}
          <div className="h-0.5 bg-gradient-to-r from-green-500 via-green-400 to-transparent" />
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold transition-all animate-slide-down ${
                  isActive(link.path)
                    ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span>{link.label}</span>
                {isActive(link.path) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                )}
              </Link>
            ))}
            {user?.is_admin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                  isActive('/admin')
                    ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>Admin</span>
                {isActive('/admin') && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
              </Link>
            )}
          </div>
          {user && (
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800/60">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar
