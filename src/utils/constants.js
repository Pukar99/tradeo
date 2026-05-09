// ── Shared constants — single source of truth for all Screen page components ──

// NEPSE + sector indexes (id matches index_ohlcv.index_id)
export const INDEX_OPTIONS = [
  { id: 58,  label: 'NEPSE',          short: 'NEPSE'    },
  { id: 12,  label: 'Sensitive',      short: 'Sens.'    },
  { id: 50,  label: 'Float',          short: 'Float'    },
  { id: 13,  label: 'NEPSE 20',       short: 'N20'      },
  { id: 14,  label: 'Banking',        short: 'Bank'     },
  { id: 15,  label: 'Dev. Bank',      short: 'Dev.B'    },
  { id: 16,  label: 'Finance',        short: 'Fin.'     },
  { id: 17,  label: 'Microfinance',   short: 'MFin.'    },
  { id: 18,  label: 'Life Insurance', short: 'Life'     },
  { id: 19,  label: 'Non-Life Ins.',  short: 'N-Life'   },
  { id: 20,  label: 'Others',         short: 'Other'    },
  { id: 21,  label: 'Manufacturing',  short: 'Mfg.'     },
  { id: 22,  label: 'Trading',        short: 'Trade'    },
  { id: 23,  label: 'Hydropower',     short: 'Hydro'    },
  { id: 24,  label: 'Hotels',         short: 'Hotel'    },
  { id: 25,  label: 'Investment',     short: 'Invest'   },
  { id: 26,  label: 'Mutual Funds',   short: 'MF'       },
]

// English month abbreviations (1-indexed: MONTHS[0] = 'Jan', MONTHS[11] = 'Dec')
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Nepali month names (Bikram Sambat, index 0 = Baisakh)
export const MONTHS_NP = ['Bai','Jes','Asa','Shr','Bha','Asw','Kar','Man','Pou','Mag','Fal','Cha']

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
