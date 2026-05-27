// =============================================================================
// constants.js — Single source of truth for all shared app constants
// =============================================================================
// Sections:
//   1. NEPSE Indices    — INDEX_OPTIONS, lookup Maps, indexLabel, sectorLabel
//   2. Date Helpers     — MONTHS, MONTHS_FULL, MONTHS_NP
//   3. Derived Sets     — SECTOR_IDS
//   4. Backtest Enums   — SPEEDS, BT_STATUS, BT_ORDER_STATUS, BT_EXIT_REASON
//   5. Thresholds       — ALERT_PCT_THRESHOLD, RECENT_N
// =============================================================================
// DB mapping notes:
//   id           → index_ohlcv.index_id       (used in chart/monthly-returns queries)
//   sector_index → company_master.sector_index (must match index_ohlcv.index_name exactly)
//   label        → user-facing display name
//   short        → abbreviated label for compact UIs
// =============================================================================


// =============================================================================
// 1. NEPSE INDICES
// =============================================================================

export const INDEX_OPTIONS = [
  // Main market indices (no sector_index — not used in sector-stock lookups)
  { id: 12, label: 'NEPSE',            short: 'NEPSE',    sector_index: null           },
  { id: 16, label: 'Sensitive',        short: 'Sens.',    sector_index: null           },
  { id: 17, label: 'NEPSE 20',         short: 'N20',      sector_index: null           },

  // Sector sub-indices — sector_index must match index_ohlcv.index_name exactly
  { id: 1,  label: 'Commercial Bank',  short: 'Bank',     sector_index: 'Banking Sub-Index'         },
  { id: 2,  label: 'Development Bank', short: 'DevBank',  sector_index: 'Development Bank Index'    },
  { id: 3,  label: 'Finance',          short: 'Finance',  sector_index: 'Finance Index'             },
  { id: 4,  label: 'Hotels & Tourism', short: 'Hotel',    sector_index: 'Hotel Tourism Index'       },
  { id: 5,  label: 'Hydro Power',      short: 'Hydro',    sector_index: 'Hydropower Index'          },
  { id: 6,  label: 'Life Insurance',   short: 'Life',     sector_index: 'Life Insurance Index'      },
  { id: 8,  label: 'Manufacturing',    short: 'Mfg',      sector_index: 'Manufacturing Index'       },
  { id: 9,  label: 'Microfinance',     short: 'MFI',      sector_index: 'Microfinance Index'        },
  { id: 10, label: 'Mutual Fund',      short: 'MF',       sector_index: 'Mutual Fund Index'         },
  { id: 11, label: 'Non-Life Ins.',    short: 'Non-Life', sector_index: 'Non-Life Insurance Index'  },
  { id: 13, label: 'Others',           short: 'Others',   sector_index: 'Others Index'              },
  { id: 14, label: 'Trading',          short: 'Trading',  sector_index: 'Trading Index'             },
  { id: 15, label: 'Investment',       short: 'Invest',   sector_index: 'Investment Index'          },
]

// Pre-built Maps — avoids repeated .find() across callers
export const INDEX_BY_ID = new Map(INDEX_OPTIONS.map(o => [o.id, o]))
export const INDEX_BY_SI = new Map(INDEX_OPTIONS.filter(o => o.sector_index).map(o => [o.sector_index, o]))

// Resolve index_id → display label. Returns fallback (default '') when id is unknown.
export const indexLabel = (id, fallback = '') =>
  INDEX_BY_ID.get(id)?.label ?? fallback

// Resolve sector_index string → display label. Falls back to fallback, then the raw string.
export const sectorLabel = (sectorIndex, fallback) =>
  INDEX_BY_SI.get(sectorIndex)?.label ?? fallback ?? sectorIndex

// =============================================================================
// 2. DATE HELPERS
// =============================================================================

export const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTHS_NP   = ['Bai','Jes','Asa','Shr','Bha','Asw','Kar','Man','Pou','Mag','Fal','Cha']


// =============================================================================
// 3. DERIVED SETS
// =============================================================================

// Sector-only index IDs — excludes main market indices (12 NEPSE, 16 Sensitive, 17 NEPSE 20)
export const SECTOR_IDS = INDEX_OPTIONS.filter(o => o.sector_index).map(o => o.id)


// =============================================================================
// 4. BACKTEST ENUMS
// =============================================================================

// Keep all three enums in sync with backend CHECK constraints in backtest schema
export const SPEEDS = ['0.5', '1', '2', '5', '10']

export const BT_STATUS = {
  ACTIVE:     'ACTIVE',
  COMPLETED:  'COMPLETED',
  ABANDONED:  'ABANDONED',
}

export const BT_ORDER_STATUS = {
  OPEN:      'OPEN',
  PARTIAL:   'PARTIAL',
  CLOSED:    'CLOSED',
  ABANDONED: 'ABANDONED',
}

export const BT_EXIT_REASON = {
  TP_HIT:     'TP_HIT',
  SL_HIT:     'SL_HIT',
  MANUAL:     'MANUAL',
  EARLY_EXIT: 'EARLY_EXIT',
  SL_IGNORED: 'SL_IGNORED',
  ABANDONED:  'ABANDONED',
}


// =============================================================================
// 5. THRESHOLDS
// =============================================================================

export const RECENT_N           = 5     // years treated as high-weight in InsightPage weighted avg
export const ALERT_PCT_THRESHOLD = 0.02 // SL/TP proximity alert fires when price is within 2% of level
