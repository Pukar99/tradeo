// =============================================================================
// Navbar.jsx — Top navigation bar
// =============================================================================
// Sections:
//   1. TradeoLogo  — SVG logo mark
//   2. Helpers     — getInitials
//   3. Navbar      — main component (auto-hide, dropdown, mobile menu)
// =============================================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications'
import PageSkeleton from './PageSkeleton'

// =============================================================================
// 1. LOGO
// =============================================================================

function TradeoLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1" />
      <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e" />
      <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5" />
      <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5" />
      <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444" />
      <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5" />
      <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5" />
      <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e" />
      <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5" />
      <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5" />
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
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// =============================================================================
// 3. NAVBAR
// =============================================================================

function Navbar({ autoHide = false, hidden = false, onMouseEnter, onMouseLeave }) {
  const { user, logout, loading: authLoading } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { t, isNepali, toggleLang } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const dropdownRef = useRef(null)

  // Notification bell
  const [bellOpen, setBellOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const bellRef = useRef(null)
  const notifDirty = useRef(true) // true = needs fetch

  // useMemo — t changes only on language toggle, not on every render
  // `authOnly`: route is behind PrivateRoute — show a lock affordance to guests
  // so the click→/login bounce isn't a surprise. Links stay clickable on purpose.
  const NAV_LINKS = useMemo(
    () => [
      { path: '/', label: t('nav.home') },
      { path: '/screen', label: 'Screen' },
      { path: '/logs', label: 'Logs', authOnly: true },
      { path: '/datalab', label: 'Data Lab' },
      { path: '/explore', label: 'Explore' },
    ],
    [t]
  )

  // Small lock glyph reused in desktop + mobile nav for guest-locked links
  const LockGlyph = (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-40 flex-shrink-0"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )

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
    if (user) {
      notifDirty.current = true
      fetchNotifs()
    } else {
      setNotifs([])
      setUnread(0)
    }
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
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnread((prev) => Math.max(0, prev - 1))
    } catch {
      /* silent */
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
    } catch {
      /* silent */
    }
  }

  const isActive = useCallback(
    (path) => {
      if (path === '/') return location.pathname === '/'
      return location.pathname.startsWith(path)
    },
    [location.pathname]
  )

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
              className="hidden lg:inline text-[11px] text-gray-400 dark:text-gray-500 font-semibold"
              title={`Tradeo v${import.meta.env.VITE_APP_VERSION}`}
            >
              v{import.meta.env.VITE_APP_VERSION}
            </span>
          </div>
        </Link>

        {/* Desktop nav — hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative px-3 py-4 text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                isActive(link.path)
                  ? 'text-green-600 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {link.label}
              {link.authOnly && !user && LockGlyph}
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
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Language toggle — hidden on the narrowest phones to avoid top-bar overflow */}
        <button
          onClick={toggleLang}
          className="hidden xs:flex items-center gap-1 min-h-[44px] px-2.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isNepali ? 'Switch to English' : 'नेपालीमा हेर्नुस्'}
          aria-label={isNepali ? 'Switch to English' : 'Switch to Nepali'}
        >
          <span className="text-[13px]">{isNepali ? '🇬🇧' : '🇳🇵'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={`${isDark ? 'Switch to Light' : 'Switch to Dark'} (Alt+D)`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>

        {/* Notification bell — logged in, desktop only.
            On mobile it would crowd the top bar and push the hamburger off the
            right edge (overflowed at 320px), so notifications live in the drawer. */}
        {user && (
          <div className="relative hidden lg:block" ref={bellRef}>
            <button
              onClick={() => setBellOpen((prev) => !prev)}
              aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
              className="relative w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
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
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    Notifications
                  </p>
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
                    notifs.map((n) => (
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
                          <div
                            className="flex-1 min-w-0"
                            style={n.read ? { paddingLeft: '14px' } : {}}
                          >
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {n.title}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {n.body}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(n.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
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

        {authLoading ? (
          /* ── Auth still resolving (/api/auth/me in flight) ──────────────────
             Render a neutral placeholder, NOT the guest branch — otherwise the
             logged-out Login/Get-Started UI flashes for ~1s on every reload
             before `user` hydrates. Sized to the avatar to avoid layout shift. */
          <PageSkeleton variant="navbar" />
        ) : user ? (
          /* ── User profile dropdown — desktop only ──────────────────────────
             On mobile, profile + logout live in the hamburger drawer; keeping
             this avatar in the top bar too overflowed the row at 320px. */
          <div className="relative hidden lg:block" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
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
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
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
                    { to: '/', icon: '🏠', label: t('nav.dashboard'), kbd: 'Alt+H' },
                    { to: '/profile', icon: '👤', label: t('nav.profile') },
                    { to: '/settings', icon: '⚙️', label: t('nav.settings') },
                    { to: '/chat', icon: '🤖', label: t('nav.aiChat'), kbd: 'Alt+C' },
                    { to: '/logs', icon: '📈', label: t('nav.tradeLog'), kbd: 'Alt+L' },
                    { to: '/portfolio', icon: '💼', label: t('nav.portfolio'), kbd: 'Alt+P' },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                        location.pathname === item.to
                          ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{item.icon}</span> {item.label}
                      {item.kbd && (
                        <kbd className="ml-auto text-[9px] font-sans text-gray-300 dark:text-gray-600">
                          {item.kbd}
                        </kbd>
                      )}
                    </Link>
                  ))}
                </div>
                <div className="p-1 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
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
            {/* Login text link — desktop only; on mobile it lives in the hamburger menu */}
            <Link
              to="/login"
              className="hidden lg:inline-flex text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              {t('nav.login')}
            </Link>
            <Link
              to="/signup"
              className="text-[13px] xs:text-sm bg-green-500 hover:bg-green-400 text-white px-2.5 xs:px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        )}

        {/* ── Mobile hamburger — only on small screens ───────────────────── */}
        <button
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          className={`lg:hidden w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
            mobileMenuOpen
              ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {mobileMenuOpen ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile menu drawer — slide-down on open ─────────────────────────── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop — dims the page and catches taps to close. The drawer itself
              is now fully opaque, so page content no longer bleeds through it (the
              old bg-white/95 + blur let the homepage show through — looked broken).
              Portaled to <body>: the nav has backdrop-filter (.glass-bar), which
              makes it a containing block for position:fixed children — an in-nav
              backdrop gets clipped to the bar's height (the 360x60 bug) instead of
              filling the viewport. The portal escapes that containing block. */}
          {createPortal(
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/40 z-40 animate-fade-in"
            />,
            document.body
          )}
          <div className="lg:hidden absolute top-full left-0 right-0 max-h-[calc(100vh-56px)] overflow-y-auto bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-2xl z-50 animate-slide-down">
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
                <span className="inline-flex items-center gap-1.5">
                  {link.label}
                  {link.authOnly && !user && LockGlyph}
                </span>
                {isActive(link.path) && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
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
          {authLoading ? (
            /* Auth resolving — show nothing rather than the guest login, matching
               the desktop placeholder behavior (no flash, no layout commitment). */
            null
          ) : user ? (
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800/60 space-y-1">
              {/* Notifications — the standalone bell is desktop-only, so surface
                  it here on mobile. Reuses the same notif state/handlers. */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    🔔 Notifications
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-red-500 rounded-full text-[10px] font-bold text-white leading-none">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-green-600 dark:text-green-400 hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifs.length > 0 && (
                  <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 border-t border-gray-100 dark:border-gray-800/60">
                    {notifs.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className={`w-full text-left px-4 py-2.5 transition-colors ${
                          n.read
                            ? 'hover:bg-gray-100 dark:hover:bg-gray-800/40'
                            : 'bg-green-50 dark:bg-green-900/10'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0" style={n.read ? { paddingLeft: '14px' } : {}}>
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {n.title}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile — moved off the top bar on mobile */}
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                  location.pathname === '/profile'
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>👤</span> {t('nav.profile')}
              </Link>

              {/* Settings — in profile menu */}
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                  location.pathname === '/settings'
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>⚙️</span> {t('nav.settings')}
              </Link>

              {/* Portfolio — off the main nav, reachable via profile menu only */}
              <Link
                to="/portfolio"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white transition-all"
              >
                <span>💼</span> {t('nav.portfolio')}
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            /* Guest auth — only in the mobile menu (the inline Login link is desktop-only) */
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800/60">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center px-4 py-3 min-h-[48px] rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all"
              >
                {t('nav.login')}
              </Link>
            </div>
          )}
          </div>
        </>
      )}
    </nav>
  )
}

export default Navbar
