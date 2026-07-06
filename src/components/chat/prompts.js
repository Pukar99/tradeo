// ── Chip definitions ─────────────────────────────────────────────────────────
export const QUICK_CHIPS = [
  {
    id: 'buy',
    label: 'Buy',
    icon: '📈',
    color:
      'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30',
  },
  {
    id: 'sell',
    label: 'Sell',
    icon: '📉',
    color:
      'text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30',
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: '👁️',
    color:
      'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30',
  },
  {
    id: 'sltp',
    label: 'SL/TP',
    icon: '🎯',
    color:
      'text-orange-500 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30',
  },
  {
    id: 'fee',
    label: 'Fees',
    icon: '🧮',
    color:
      'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/30',
  },
  {
    id: 'brief',
    label: 'Brief',
    icon: '☀️',
    color:
      'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
  },
]

export const PRESET_PROMPTS = [
  { icon: '📊', text: 'Show my open positions' },
  { icon: '📐', text: 'Trade plan for NABIL' },
  { icon: '⚠️', text: 'Show my risk summary' },
  { icon: '📅', text: 'How did I do this week?' },
  { icon: '🔥', text: 'Top gainers today on NEPSE' },
  { icon: '🎯', text: 'Suggest SL for my open trades' },
  { icon: '🧮', text: 'Calculate broker fee for buying 100 kittas at Rs.500' },
  { icon: '📝', text: 'Draft a journal for my latest trade' },
]

// ── Slash commands — type "/" in the input for the full capability list ───────
// type: 'form'   → opens the matching QuickForm
//       'send'   → sends a preset message to the agent immediately
//       'insert' → inserts a stub into the input for the user to finish
//       'new'    → clears the conversation
export const SLASH_COMMANDS = [
  { cmd: 'buy', icon: '📈', desc: 'Log a buy trade', type: 'form', arg: 'buy' },
  { cmd: 'sell', icon: '📉', desc: 'Close / sell a trade', type: 'form', arg: 'sell' },
  { cmd: 'watch', icon: '👁️', desc: 'Add a stock to watchlist', type: 'form', arg: 'watchlist' },
  { cmd: 'sltp', icon: '🎯', desc: 'Update stop loss / target', type: 'form', arg: 'sltp' },
  { cmd: 'fee', icon: '🧮', desc: 'NEPSE broker fee calculator', type: 'form', arg: 'fee' },
  {
    cmd: 'plan',
    icon: '📐',
    desc: 'AI trade plan for a stock',
    type: 'insert',
    arg: 'Trade plan for ',
  },
  { cmd: 'price', icon: '💹', desc: 'Live price of a stock', type: 'insert', arg: 'Price of ' },
  {
    cmd: 'brief',
    icon: '☀️',
    desc: 'Morning trading brief',
    type: 'send',
    arg: 'Morning brief — show my trading summary for today',
  },
  {
    cmd: 'risk',
    icon: '⚠️',
    desc: 'Capital-at-risk summary',
    type: 'send',
    arg: 'Show my risk summary',
  },
  {
    cmd: 'week',
    icon: '📅',
    desc: "This week's performance",
    type: 'send',
    arg: 'How did I do this week?',
  },
  { cmd: 'trades', icon: '📋', desc: 'Show open trades', type: 'send', arg: 'Show my open trades' },
  { cmd: 'goals', icon: '🏆', desc: 'Show goals', type: 'send', arg: 'Show my goals' },
  {
    cmd: 'journal',
    icon: '📝',
    desc: 'Show journal entries',
    type: 'send',
    arg: 'Show my journal',
  },
  { cmd: 'undo', icon: '↩️', desc: 'Undo last action', type: 'send', arg: 'Undo my last action' },
  { cmd: 'new', icon: '🧹', desc: 'Start a new chat', type: 'new' },
]

// ── Contextual follow-ups — suggested next steps after an action completes ────
// Keyed by actionType; each returns [{ label, text }] sent as a normal message.
export const FOLLOW_UPS = {
  ADD_TRADE: (r) => [
    r.trade?.symbol && { label: '✏️ Draft journal', text: `Draft a journal for ${r.trade.symbol}` },
    { label: '⚠️ Risk summary', text: 'Show my risk summary' },
  ],
  CLOSE_TRADE: (r) => [
    r.trade?.symbol && { label: '✏️ Draft journal', text: `Draft a journal for ${r.trade.symbol}` },
    { label: '📅 Week so far', text: 'How did I do this week?' },
  ],
  STOCK_PRICE: (r) => [
    r.symbol && { label: '📐 Trade plan', text: `Trade plan for ${r.symbol}` },
    r.symbol && { label: '👁️ Watch', text: `Add ${r.symbol} to watchlist` },
  ],
  TRADE_PLAN: (r) => [
    r.plan?.symbol && {
      label: '👁️ Add to watchlist',
      text: `Add ${r.plan.symbol} to watchlist with price alert Rs.${r.plan.suggested_entry}`,
    },
  ],
  SHOW_TRADES: () => [{ label: '⚠️ Risk summary', text: 'Show my risk summary' }],
  SHOW_RISK_SUMMARY: (r) => [
    r.noSlCount > 0 && { label: '🎯 Fix missing SLs', text: 'Suggest SL for my open trades' },
    { label: '📋 Open trades', text: 'Show my open trades' },
  ],
  WEEKLY_SUMMARY: () => [{ label: '📋 Show trades', text: 'Show my trades' }],
  MORNING_BRIEF: () => [{ label: '⚠️ Risk summary', text: 'Show my risk summary' }],
}
