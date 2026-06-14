// === AdminRoute.jsx ===
// Admin gate — three states:
//   1. Auth resolving   → spinner (prevents flash redirect on refresh)
//   2. Not logged in    → /login
//   3. Logged in, not admin → /
//   4. Admin            → render children

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )

  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />

  return children
}
