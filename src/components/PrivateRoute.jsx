// =============================================================================
// PrivateRoute.jsx — Auth gate: redirects unauthenticated users to /login
// =============================================================================
// Saves intended destination in sessionStorage so login can redirect back.
// Open-redirect prevention: rejects external URLs and protocol-relative paths.
// sessionStorage calls are wrapped in try/catch — throws in private/restricted mode.
// =============================================================================

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function saveRedirectFrom(path) {
  if (!path || path === '/login' || path === '/signup') return
  if (/^https?:\/\/|^\/\//.test(path)) return
  try { sessionStorage.setItem('authRedirectFrom', path) } catch { /* private browsing */ }
}

export function getRedirectFrom() {
  let from = '/'
  try {
    from = sessionStorage.getItem('authRedirectFrom') || '/'
    sessionStorage.removeItem('authRedirectFrom')
  } catch { /* private browsing */ }
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
