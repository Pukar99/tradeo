// =============================================================================
// AuthContext.jsx — Authentication state: user, login, logout, updateUser
// Cookie preferred; localStorage fallback for Safari ITP (temporary until custom domain)
// =============================================================================

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { clearUserCache } from '../utils/globalCache'
import { API } from '../api'

const AuthContext = createContext()

// Refresh 60 seconds before the 1-day JWT expires
const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000
const JWT_LIFETIME_MS = 24 * 60 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef(null)

  const scheduleRefresh = useCallback(function schedule(token = localStorage.getItem('auth_token')) {
    clearTimeout(refreshTimer.current)
    let delay = JWT_LIFETIME_MS - REFRESH_BEFORE_EXPIRY_MS
    if (token) {
      try {
        const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(encoded))
        if (Number.isFinite(payload.exp)) {
          delay = Math.max(0, payload.exp * 1000 - Date.now() - REFRESH_BEFORE_EXPIRY_MS)
        }
      } catch {
        // Keep the default delay for malformed fallback tokens.
      }
    }
    refreshTimer.current = setTimeout(() => {
      API.post('/api/auth/refresh')
        .then(({ data }) => {
          if (data.token) localStorage.setItem('auth_token', data.token)
          schedule(data.token)
        })
        .catch(() => {})
    }, delay)
  }, [])

  // On mount — verify cookie with server, hydrate user state
  useEffect(() => {
    const handleExpired = () => {
      clearTimeout(refreshTimer.current)
      clearUserCache()
      setUser(null)
    }
    window.addEventListener('tradeo:auth-expired', handleExpired)
    API.get('/api/auth/me')
      .then(({ data }) => {
        setUser(data.user)
        scheduleRefresh()
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
    return () => window.removeEventListener('tradeo:auth-expired', handleExpired)
  }, [scheduleRefresh])

  const login = (userData, token) => {
    clearUserCache()
    if (token) localStorage.setItem('auth_token', token)
    sessionStorage.setItem('ipoAutoApplyPending', '1')
    setUser(userData)
    scheduleRefresh()
  }

  const updateUser = (updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : updatedData))
  }

  const logout = () => {
    clearTimeout(refreshTimer.current)
    const token = localStorage.getItem('auth_token')
    API.post('/api/auth/logout', null, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .catch(() => {})
    localStorage.removeItem('auth_token')
    clearUserCache()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
