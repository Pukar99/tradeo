// =============================================================================
// AuthContext.jsx — Authentication state: user, login, logout, updateUser
// Token lives in httpOnly cookie only — never localStorage (SEC-001)
// =============================================================================

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { clearUserCache } from '../utils/globalCache'
import { API } from '../api'

const AuthContext = createContext()

// Refresh 60 seconds before the 1-day JWT expires
const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000
const JWT_LIFETIME_MS          = 24 * 60 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer          = useRef(null)

  function scheduleRefresh() {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      API.post('/api/auth/refresh')
        .then(() => scheduleRefresh()) // re-schedule after successful refresh
        .catch(() => {})               // interceptor handles 403 → redirect
    }, JWT_LIFETIME_MS - REFRESH_BEFORE_EXPIRY_MS)
  }

  // On mount — verify cookie with server, hydrate user state
  useEffect(() => {
    API.get('/api/auth/me')
      .then(({ data }) => {
        setUser(data.user)
        scheduleRefresh()
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => {
    sessionStorage.setItem('ipoAutoApplyPending', '1')
    setUser(userData)
    scheduleRefresh()
  }

  const updateUser = (updatedData) => {
    setUser(prev => prev ? { ...prev, ...updatedData } : updatedData)
  }

  const logout = () => {
    clearTimeout(refreshTimer.current)
    API.post('/api/auth/logout').catch(() => {})
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
