import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

function safeParseUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(safeParseUser)

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const updateUser = (updatedData) => {
    let existing = null
    try {
      existing = JSON.parse(localStorage.getItem('user')) || {}
    } catch {
      existing = {}
    }
    const updated = { ...existing, ...updatedData }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Clear once-per-session flags so they fire again on next login
    sessionStorage.removeItem('briefingShown')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}