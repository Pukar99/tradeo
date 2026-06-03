// =============================================================================
// AuthContext.jsx — Authentication state: user, login, logout, updateUser
// Token lives in httpOnly cookie only — never localStorage (SEC-001)
// =============================================================================

import { createContext, useContext, useState, useEffect } from 'react'
import { clearUserCache } from '../utils/globalCache'
import { API } from '../api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount — verify cookie with server, hydrate user state
  useEffect(() => {
    API.get('/api/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => {
    sessionStorage.setItem('ipoAutoApplyPending', '1')
    setUser(userData)
  }

  const updateUser = (updatedData) => {
    setUser(prev => prev ? { ...prev, ...updatedData } : updatedData)
  }

  const logout = () => {
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
