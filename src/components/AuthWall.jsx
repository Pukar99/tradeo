// =============================================================================
// AuthWall.jsx — Shared "login required" wall for guest-locked free-route features.
// =============================================================================
// Replaces the three near-identical copies that lived in ScreenPage, DataLabPage,
// and ExplorePage. In-place gating (no redirect): the locked tab/content area
// swaps to this wall, which offers Login + "Sign up free".
//
// Props:
//   feature   — display name; "{feature} requires login". Omit for the generic
//               "Login required" copy (DataLab-style).
//   subtitle  — override the default sub-line.
//   className  — container positioning. Defaults to a flex-fill column.
//               Pass "absolute inset-0 ..." for overlay layouts (Explore).
// =============================================================================

import { Link } from 'react-router-dom'

export default function AuthWall({
  feature,
  subtitle,
  className = 'flex-1 h-full flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-up',
}) {
  const title = feature ? `${feature} requires login` : 'Login required'
  const sub =
    subtitle ?? (feature ? 'Sign in to access this feature' : 'Sign in to access this feature')

  return (
    <div className={className}>
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Login
        </Link>
        <Link
          to="/signup"
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          Sign up free
        </Link>
      </div>
    </div>
  )
}
