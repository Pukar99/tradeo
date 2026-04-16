import { useState, useEffect, useCallback } from 'react'
import { btGetSymbols, btCreateSession } from '../../api/backtest'

const SPEEDS = ['0.5', '1', '2', '5', '10']

export default function BacktestSetupPanel({ onSessionStarted }) {
  const [symbols, setSymbols]             = useState([])
  const [symbol, setSymbol]               = useState('')
  const [symbolSearch, setSymbolSearch]   = useState('')
  const [showSymbolList, setShowSymbolList] = useState(false)
  const [startDate, setStartDate]         = useState('')
  const [capital, setCapital]             = useState('500000')
  const [strategyName, setStrategyName]   = useState('')
  const [runMode, setRunMode]             = useState('PLAY')
  const [speed, setSpeed]                 = useState('1')
  const [slMode, setSlMode]               = useState('MANUAL')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [symbolsLoading, setSymbolsLoading] = useState(true)

  useEffect(() => {
    btGetSymbols()
      .then(r => setSymbols(r.data.symbols || []))
      .catch(() => {})
      .finally(() => setSymbolsLoading(false))
  }, [])

  const filteredSymbols = symbols.filter(s =>
    s.symbol.toLowerCase().includes(symbolSearch.toLowerCase())
  ).slice(0, 50)

  const selectedSymbolData = symbols.find(s => s.symbol === symbol)

  const handleStart = useCallback(async () => {
    setError('')
    if (!symbol)          return setError('Select a script (symbol)')
    if (!startDate)       return setError('Select a start date')
    if (!strategyName.trim()) return setError('Enter a strategy name')
    const cap = parseFloat(capital)
    if (!cap || cap < 10000) return setError('Minimum capital is Rs. 10,000')

    setLoading(true)
    try {
      const res = await btCreateSession({
        strategy_name:   strategyName.trim(),
        initial_capital: cap,
        sl_mode:         slMode,
        scripts: [{ symbol, start_date: startDate }],
      })
      onSessionStarted(res.data, { runMode, speed })
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }, [symbol, startDate, strategyName, capital, slMode, runMode, speed, onSessionStarted])

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
        Backtest Setup
      </div>

      {/* Script */}
      <div className="relative">
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Script</label>
        <div
          className="mt-0.5 flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer text-[11px]"
          onClick={() => setShowSymbolList(v => !v)}
        >
          <span className={symbol ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400'}>
            {symbol || (symbolsLoading ? 'Loading…' : 'Select symbol')}
          </span>
          <svg className="ml-auto w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {showSymbolList && (
          <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
            <input
              autoFocus
              value={symbolSearch}
              onChange={e => setSymbolSearch(e.target.value)}
              placeholder="Search…"
              className="w-full px-2 py-1.5 text-[11px] border-b border-gray-100 dark:border-gray-700 bg-transparent outline-none dark:text-white"
            />
            <div className="max-h-40 overflow-y-auto">
              {filteredSymbols.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => { setSymbol(s.symbol); setShowSymbolList(false); setSymbolSearch('') }}
                  className="px-2 py-1 text-[11px] hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-gray-800 dark:text-gray-200"
                >
                  <span className="font-semibold">{s.symbol}</span>
                  <span className="text-gray-400 ml-2 text-[9px]">{s.total_days}d</span>
                </div>
              ))}
              {filteredSymbols.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-gray-400">No results</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Start Date */}
      <div>
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</label>
        <input
          type="date"
          value={startDate}
          min={selectedSymbolData?.earliest_date}
          max={selectedSymbolData?.latest_date}
          onChange={e => setStartDate(e.target.value)}
          className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
        />
        {selectedSymbolData && (
          <div className="text-[9px] text-gray-400 mt-0.5">
            {selectedSymbolData.earliest_date} → {selectedSymbolData.latest_date}
          </div>
        )}
      </div>

      {/* Initial Capital */}
      <div>
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capital (NPR)</label>
        <input
          type="number"
          value={capital}
          min={10000}
          step={1000}
          onChange={e => setCapital(e.target.value)}
          className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Strategy Name */}
      <div>
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Strategy Name</label>
        <input
          type="text"
          value={strategyName}
          onChange={e => setStrategyName(e.target.value)}
          placeholder="e.g. Breakout Test"
          className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Run Mode */}
      <div>
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Run Mode</label>
        <div className="mt-0.5 flex gap-2">
          {['PLAY', 'MANUAL'].map(m => (
            <button
              key={m}
              onClick={() => setRunMode(m)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                runMode === m
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400'
              }`}
            >
              {m === 'PLAY' ? '▶ Play' : '→ Manual'}
            </button>
          ))}
        </div>
      </div>

      {/* Play Speed — only if PLAY */}
      {runMode === 'PLAY' && (
        <div>
          <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Play Speed</label>
          <div className="mt-0.5 flex gap-1 flex-wrap">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SL Validation Mode */}
      <div>
        <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          SL Validation
        </label>
        <div className="mt-0.5 flex gap-2">
          {['MANUAL', 'AUTO'].map(m => (
            <button
              key={m}
              onClick={() => setSlMode(m)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                slMode === m
                  ? m === 'AUTO'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
          {slMode === 'AUTO'
            ? 'System auto-closes when SL is hit after T+2'
            : 'System asks you before closing on SL breach'}
        </div>
      </div>

      {error && (
        <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-auto w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
      >
        {loading ? 'Starting…' : 'Start Backtest'}
      </button>

      <div className="text-[9px] text-gray-400 text-center leading-tight">
        NEPSE · Long only · T+2 settlement · No intraday
      </div>
    </div>
  )
}
