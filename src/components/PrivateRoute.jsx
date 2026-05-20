import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Validates stored path is an internal route — rejects external URLs (open redirect prevention).
function saveRedirectFrom(path) {
  if (!path || path === '/login' || path === '/signup') return
  if (/^https?:\/\/|^\/\//.test(path)) return
  sessionStorage.setItem('authRedirectFrom', path)
}

export function getRedirectFrom() {
  const from = sessionStorage.getItem('authRedirectFrom') || '/'
  sessionStorage.removeItem('authRedirectFrom')
  if (!from.startsWith('/') || /^\/\//.test(from)) return '/'
  return from
}

export default function PrivateRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    // Save intended destination synchronously before redirecting
    saveRedirectFrom(location.pathname + location.search)
    // <Navigate> redirects during render — zero flash, no useEffect delay
    return <Navigate to="/login" replace />
  }

  return children
}
