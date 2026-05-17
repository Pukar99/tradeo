// ── Shared constants — single source of truth for all Screen page components ──
// index_id values match index_ohlcv.index_id in the database
// sector_index values match company_master.sector_index in the database
// Labels are the UI display names shown to the user

/**
 * All NEPSE sector indices.
 * - id         : index_ohlcv.index_id (integer key used in all API calls)
 * - label      : user-facing display name (shown in selectors, headings)
 * - short      : abbreviated label for compact UIs
 * - sector_index: company_master.sector_index value — used to look up companies
 *                 in the sector-month-stocks endpoint
 *
 * Data flow:
 *   Scraper → index_ohlcv(index_id, index_name, date, ...)
 *   Scraper → company_master(symbol, sector, sector_index, ...)
 *   API uses  index_id  for chart/monthly-returns queries
 *   API uses  sector_index  for stock-in-sector queries
 *   sector_index = index_ohlcv.index_name  (they must match exactly)
 */
export const INDEX_OPTIONS = [
  // ── Main market indices (used in StockChart + InsightPage default) ──────────
  { id: 12, label: 'NEPSE',            short: 'NEPSE',    sector_index: null           },
  { id: 16, label: 'Sensitive',        short: 'Sens.',    sector_index: null           },
  { id: 17, label: 'NEPSE 20',         short: 'N20',      sector_index: null           },

  // ── Sector sub-indices (used in InsightPage heatmap + BreakdownPage) ────────
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

// Lookup helpers — avoids repeated .find() calls in components
export const INDEX_BY_ID    = new Map(INDEX_OPTIONS.map(o => [o.id,           o]))
export const INDEX_BY_SI    = new Map(INDEX_OPTIONS.filter(o => o.sector_index)
                                                   .map(o => [o.sector_index, o]))

/** Get user-friendly label for an index_id. Falls back to the raw index_name. */
export const indexLabel = (id, fallback = '') =>
  INDEX_BY_ID.get(id)?.label ?? fallback

/** Get user-friendly label for a sector_index string (e.g. "Banking Sub-Index" → "Commercial Bank") */
export const sectorLabel = (sectorIndex, fallback) =>
  INDEX_BY_SI.get(sectorIndex)?.label ?? fallback ?? sectorIndex

// English month abbreviations (0-indexed: MONTHS[0] = 'Jan')
export const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// Full English month names (0-indexed). Single source of truth — avoids drift
// from inline arrays in component files.
export const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTHS_NP   = ['Bai','Jes','Asa','Shr','Bha','Asw','Kar','Man','Pou','Mag','Fal','Cha']

// Sector IDs used in InsightPage heatmap and BreakdownPage cycle analysis
// (excludes main market indices 12/16/17)
export const SECTOR_IDS = INDEX_OPTIONS.filter(o => o.sector_index).map(o => o.id)

// Backtest playback speed options
export const SPEEDS = ['0.5', '1', '2', '5', '10']

// Number of recent years treated as "high weight" in InsightPage weighted avg
export const RECENT_N = 5

// Backtest session/position status enums — keep in sync with backend CHECK constraints
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

// SL/TP proximity alert threshold for LeftPanel (2% from level)
export const ALERT_PCT_THRESHOLD = 0.02
