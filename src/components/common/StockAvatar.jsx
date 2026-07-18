// === StockAvatar.jsx — deterministic per-symbol color chip + avatar ===
// Extracted from HomePage (t30 HOME-10). Hash the FULL symbol — using only
// charCodeAt(0) collapsed every same-initial symbol (NABIL/NTC/NLIC/NICA…)
// onto one color, which is common in NEPSE banks.

const STOCK_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-cyan-500',
]
const STOCK_BORDERS = [
  'border-blue-400',
  'border-green-400',
  'border-purple-400',
  'border-orange-400',
  'border-pink-400',
  'border-teal-400',
  'border-red-400',
  'border-indigo-400',
  'border-yellow-400',
  'border-cyan-400',
]
const STOCK_BAR_COLORS = [
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-orange-400',
  'bg-pink-400',
  'bg-teal-400',
  'bg-red-400',
  'bg-indigo-400',
  'bg-yellow-400',
  'bg-cyan-400',
]

function hashSymbol(symbol) {
  let h = 0
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getStockColor(symbol) {
  if (!symbol) return 'bg-blue-500'
  return STOCK_COLORS[hashSymbol(symbol) % STOCK_COLORS.length]
}

export function getStockBorder(symbol) {
  if (!symbol) return 'border-blue-400'
  return STOCK_BORDERS[hashSymbol(symbol) % STOCK_BORDERS.length]
}

export function getStockBar(symbol) {
  if (!symbol) return 'bg-blue-400'
  return STOCK_BAR_COLORS[hashSymbol(symbol) % STOCK_BAR_COLORS.length]
}

export default function StockAvatar({ symbol, size = 'w-8 h-8', textSize = 'text-xs' }) {
  return (
    <div
      className={`${size} ${getStockColor(symbol)} rounded-lg flex items-center justify-center flex-shrink-0`}
    >
      <span className={`text-white font-bold ${textSize}`}>{symbol?.slice(0, 2) || '??'}</span>
    </div>
  )
}
