import { useScreen } from '../../context/ScreenContext'

const TIMEFRAMES  = ['1D', '1W', '1M', '6M', '1Y', '3Y', 'ALL']
const INDICATORS  = ['MA', 'RSI', 'MACD']

export default function ChartControls() {
  const { chartType, setChartType, timeframe, setTimeframe, activeIndicators, toggleIndicator } = useScreen()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Chart type */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {['candlestick', 'line'].map(type => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {type === 'candlestick' ? 'Candle' : 'Line'}
          </button>
        ))}
      </div>

      {/* Timeframes */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-1">
        {INDICATORS.map(ind => (
          <button
            key={ind}
            onClick={() => toggleIndicator(ind)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
              activeIndicators.includes(ind)
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300'
            }`}
          >
            {ind}
          </button>
        ))}
      </div>
    </div>
  )
}
