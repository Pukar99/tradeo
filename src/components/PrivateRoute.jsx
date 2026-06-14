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
  try {
    sessionStorage.setItem('authRedirectFrom', path)
  } catch {
    /* private browsing */
  }
}

export function getRedirectFrom() {
  let from = '/'
  try {
    from = sessionStorage.getItem('authRedirectFrom') || '/'
    sessionStorage.removeItem('authRedirectFrom')
  } catch {
    /* private browsing */
  }
  if (!from.startsWith('/') || /^\/\//.test(from)) return '/'
  return from
}

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Wait for /api/auth/me to resolve before deciding — prevents flash redirect on refresh.
  // Spinner (not null) so a slow auth check doesn't look like a frozen blank page.
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )

  if (!user) {
    saveRedirectFrom(location.pathname + location.search)
    return <Navigate to="/login" replace />
  }

  return children
}
