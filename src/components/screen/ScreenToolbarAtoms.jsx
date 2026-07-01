// === ScreenToolbarAtoms.jsx — shared compact toolbar primitives for all Screen tabs ===
// Used by: SMCChartPage, PriceActionPage, MultiChartPage (and any future tab).
// Symbol search lives in components/common/SymbolSearch.jsx (shared across all tabs).
import { useState, useEffect, useCallback } from 'react'
import { useScreen } from '../../context/ScreenContext'
import { useNavbarState } from '../../App'
import { useFixedDropdown } from '../common/useFixedDropdown'

// ── ToolbarDivider ─────────────────────────────────────────────────────────────
export function ToolbarDivider() {
  return <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
}

// ── ToolbarTimeframes ──────────────────────────────────────────────────────────
// Compact segmented timeframe control reading from ScreenContext.
// Pass custom `frames` array to override defaults.
const DEFAULT_TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']

export function ToolbarTimeframes({ frames = DEFAULT_TIMEFRAMES, onChange }) {
  const { timeframe, setTimeframe } = useScreen() || {}

  const handleClick = useCallback(
    (tf) => {
      setTimeframe?.(tf)
      onChange?.(tf)
    },
    [setTimeframe, onChange]
  )

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
      {frames.map((tf) => (
        <button
          key={tf}
          onClick={() => handleClick(tf)}
          className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${
            timeframe === tf
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

// ── ToolbarToggleChip ──────────────────────────────────────────────────────────
// Inline toggle button with custom active colour.
export function ToolbarToggleChip({ label, active, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border whitespace-nowrap ${
        active
          ? 'text-white border-transparent'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      style={active ? { backgroundColor: activeColor } : {}}
    >
      {label}
    </button>
  )
}

// ── ToolbarConfigButton ────────────────────────────────────────────────────────
// Gear/config trigger + portalled popover. Pass children as the popover body.
// While open, blocks navbar autohide via a document-level mousemove listener —
// the portal sits over the chart area which would otherwise fire scheduleHide.
export function ToolbarConfigButton({ label = 'Config', children }) {
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('right')
  const { showNavbar } = useNavbarState()

  useEffect(() => {
    if (!open) return
    // Suppress autohide for the entire duration the popover is open.
    // showNavbar() clears the hide timer — calling it on every mousemove
    // means the 1s countdown never completes while the user is interacting.
    const fn = () => showNavbar()
    document.addEventListener('mousemove', fn)
    return () => document.removeEventListener('mousemove', fn)
  }, [open, showNavbar])

  return (
    <div ref={triggerRef}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          updateRect()
        }}
        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border whitespace-nowrap ${
          open
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {label}
      </button>
      {portal(
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 min-w-[220px] max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}

// ── ToolbarConfigTitle ─────────────────────────────────────────────────────────
export function ToolbarConfigTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  )
}

// ── ToolbarConfigSection ───────────────────────────────────────────────────────
export function ToolbarConfigSection({ label, children }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  )
}

// ── useCompactToolbar ──────────────────────────────────────────────────────────
// True below lg (1024px) — the breakpoint where ScreenPage gives the toolbar its
// own slot beside the tabs and StockChart's General toolbar goes compact. SMC/PA
// use this to collapse their dense toolbars into a single menu on mobile.
export function useCompactToolbar() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const fn = (e) => setCompact(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return compact
}

// ── ToolbarMenu ────────────────────────────────────────────────────────────────
// Hamburger (☰) trigger + portalled popover — the mobile equivalent of the
// General tab's chart-options menu. Pass the menu body (timeframe/toggles/config
// sections) as children. `activeCount` shows a small badge when > 0.
export function ToolbarMenu({ children, activeCount = 0, ariaLabel = 'Chart options' }) {
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('right')
  const { showNavbar } = useNavbarState()

  useEffect(() => {
    if (!open) return
    const fn = () => showNavbar()
    document.addEventListener('mousemove', fn)
    return () => document.removeEventListener('mousemove', fn)
  }, [open, showNavbar])

  return (
    <div ref={triggerRef} className="shrink-0">
      <button
        onClick={() => {
          setOpen((v) => !v)
          updateRect()
        }}
        aria-label={ariaLabel}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
          open || activeCount > 0
            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-500'
        }`}
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
        {activeCount > 0 && (
          <span className="min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-white/25 text-[10px] font-bold leading-none px-0.5">
            {activeCount}
          </span>
        )}
      </button>
      {portal(
        <div className="w-[260px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}

// ── ToolbarMenuSection ─────────────────────────────────────────────────────────
// A titled section inside ToolbarMenu (Timeframe / Overlays / Config).
export function ToolbarMenuSection({ label, children, divider = true }) {
  return (
    <>
      {divider && <div className="h-px bg-gray-100 dark:bg-gray-800 -mx-3 my-2.5" />}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
          {label}
        </p>
        {children}
      </div>
    </>
  )
}

// ── ToolbarSegment ─────────────────────────────────────────────────────────────
// Segmented button row for config options (e.g. 1%, 2%, 3%).
export function ToolbarSegment({ options, value, onChange, activeColor = 'bg-blue-600' }) {
  return (
    <div className="flex gap-1">
      {options.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
            value === v
              ? `${activeColor} text-white`
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
