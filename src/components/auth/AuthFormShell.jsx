// === AuthFormShell.jsx — shared chrome for LoginPage/SignupPage (extracted verbatim, P1.3) ===
// Bodies are byte-identical copies of what both pages duplicated. The deliberately
// different bits (brand copy, feature lists, fields, spacing values) stay in the
// pages — spacing differences arrive here as explicit class props so the rendered
// DOM stays pixel-identical to the pre-extraction pages.
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext'
import { googleAuth } from '../../api'

export function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
export function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function TradeoLogo({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" fill="#111827" strokeWidth="0" />
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

// Candlestick data for animated background bars
const CANDLES = [
  { x: 40, h: 80, t: 200, green: true },
  { x: 80, h: 140, t: 160, green: false },
  { x: 120, h: 60, t: 220, green: true },
  { x: 160, h: 110, t: 180, green: true },
  { x: 200, h: 180, t: 140, green: false },
  { x: 240, h: 90, t: 210, green: true },
  { x: 280, h: 130, t: 170, green: true },
  { x: 320, h: 70, t: 230, green: false },
  { x: 360, h: 160, t: 150, green: true },
  { x: 400, h: 100, t: 190, green: false },
]

// Dark brand column (md+) with the animated candlestick backdrop.
// Page-specific copy/features/footer render as children on top of it.
export function BrandPanelShell({ children }) {
  return (
    <div className="hidden md:flex flex-col justify-between w-[420px] shrink-0 bg-gray-950 px-10 py-10 relative overflow-hidden">
      {/* Animated candlestick background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none select-none"
        viewBox="0 0 420 700"
        preserveAspectRatio="xMidYMid slice"
      >
        {CANDLES.map((c, i) => (
          <g
            key={c.x}
            className="animate-candle-grow origin-bottom"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <line
              x1={c.x}
              y1={c.t - 20}
              x2={c.x}
              y2={c.t + c.h + 20}
              stroke={c.green ? '#22c55e' : '#ef4444'}
              strokeWidth="1"
            />
            <rect
              x={c.x - 8}
              y={c.t}
              width="16"
              height={c.h}
              fill={c.green ? '#22c55e' : '#ef4444'}
              rx="2"
            />
          </g>
        ))}
      </svg>
      {children}
    </div>
  )
}

// Inline validation message under a field.
export function FieldError({ children }) {
  return (
    <p className="animate-slide-down text-red-500 text-xs mt-1.5" aria-live="polite">
      {children}
    </p>
  )
}

// Eye toggle inside a password input's relative wrapper.
export function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      aria-label={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  )
}

// Dismissible server-error banner. mb differs per page ('mb-6' login, 'mb-5' signup).
export function AuthErrorBanner({ message, onDismiss, mb }) {
  return (
    <div
      role="alert"
      className={`animate-slide-down bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 p-3 rounded-lg ${mb} text-sm flex items-start justify-between gap-2`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-400 hover:text-red-600 flex-shrink-0 leading-none transition-colors"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  )
}

// Submit — press scale + color transition. mt differs per page ('mt-2' login, '!mt-6' signup).
export function AuthSubmitButton({ loading, busyLabel, mt, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`active:scale-95 w-full bg-blue-600 text-white min-h-[52px] py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2 ${mt} shadow-sm hover:shadow-md`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {loading ? busyLabel : children}
    </button>
  )
}

// Shared Google Sign-In button + divider — used identically by LoginPage/SignupPage.
// Owns the API call + login + redirect itself (needs useAuth/useNavigate), so
// callers just render <GoogleAuthSection onError={setServerError} /> and nothing else.
export function GoogleAuthSection({ onError }) {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSuccess = async (credentialResponse) => {
    try {
      const { data } = await googleAuth({ credential: credentialResponse.credential })
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      onError?.(err.response?.data?.message || 'Google sign-in failed, please try again')
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mt-4 flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onError?.('Google sign-in failed, please try again')}
        />
      </div>
    </div>
  )
}

// Full-page two-panel layout: brand column + form column with top bar.
// py differs per page ('py-8' login, 'py-6' signup).
export default function AuthFormShell({ brandPanel, topRightTo, topRightLabel, py, children }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (md+) ── */}
      {brandPanel}

      {/* ── Right form panel — fade-up on mount ── */}
      <div
        className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-screen animate-fade-up"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-1.5 -ml-2 px-2 min-h-[44px] text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Link>

          <div className="flex md:hidden items-center gap-2">
            <TradeoLogo size={28} />
            <span className="text-sm font-bold text-gray-900 dark:text-white">Tradeo</span>
          </div>

          <Link
            to={topRightTo}
            className="flex items-center -mr-2 px-2 min-h-[44px] text-sm text-blue-600 hover:underline font-medium transition-colors"
          >
            {topRightLabel}
          </Link>
        </div>

        {/* Form — vertically centered */}
        <div className={`flex-1 flex items-center justify-center px-6 ${py}`}>
          <div className="w-full max-w-[360px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
