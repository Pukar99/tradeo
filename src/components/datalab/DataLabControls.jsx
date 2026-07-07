// =============================================================================
// DataLabControls.jsx — shared toolbar state for the three DataLab tabs (S1).
// Spec §5.0: ONE symbol search + ONE swing threshold live in the shared
// toolbar; every tab reads the same values. Session-persisted like the tabs'
// legacy per-tab keys. Mounted by DataLabPage starting S2 (Breakdown adoption).
// =============================================================================

import { createContext, useContext, useMemo, useState } from 'react'
import { safeSessionGet, safeSessionSet } from '../../utils/safeSession'

// Mirror of the backend clamp — this is the single source of truth for the
// clamp on the frontend (BreakdownPage.jsx no longer has its own copy); tiny
// thresholds explode the cycle count.
const clampThreshold = (t) => Math.min(50, Math.max(5, parseFloat(t) || 10))

const Ctx = createContext(null)

export function DataLabControlsProvider({ children }) {
  const [symbol, setSymbolState] = useState(() => safeSessionGet('tradeo_datalab_symbol', ''))
  const [threshold, setThresholdState] = useState(() =>
    clampThreshold(safeSessionGet('tradeo_datalab_threshold', '10'))
  )

  const value = useMemo(
    () => ({
      symbol,
      threshold,
      setSymbol: (s) => {
        const v = (s || '').trim().toUpperCase()
        setSymbolState(v)
        safeSessionSet('tradeo_datalab_symbol', v)
      },
      setThreshold: (t) => {
        const v = clampThreshold(t)
        setThresholdState(v)
        safeSessionSet('tradeo_datalab_threshold', String(v))
      },
    }),
    [symbol, threshold]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDataLabControls() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDataLabControls must be used inside DataLabControlsProvider')
  return ctx
}
