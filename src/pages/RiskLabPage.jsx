import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, BarChart, Bar, Legend
} from 'recharts'

// ─── NEPSE Broker Commission ───────────────────────────────
const getBrokerCommission = (amount) => {
  if (amount <= 50000) return Math.max(amount * 0.0036, 10)
  if (amount <= 500000) return amount * 0.0025
  if (amount <= 2000000) return amount * 0.003
  if (amount <= 10000000) return amount * 0.0027
  return amount * 0.0024
}

const getSEBON = (amount) => amount * 0.00015
const getDP = () => 25
const getCGT = (gain, isLongTerm) => gain > 0 ? gain * (isLongTerm ? 0.05 : 0.075) : 0

// ─── TABS ───────────────────────────────────────────────────
const TABS = [
  { id: 'nepse', label: '🇳🇵 NEPSE', desc: 'Trade Calculator' },
  { id: 'position', label: '⚖️ Position', desc: 'Size & Risk/Reward' },
  { id: 'performance', label: '📊 Performance', desc: 'Win Rate & Drawdown' },
  { id: 'sip', label: '💰 SIP', desc: 'Systematic Investment' },
]

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6']

// ─── NEPSE CALCULATOR ──────────────────────────────────────
function NEPSECalculator() {
  const [form, setForm] = useState({
    symbol: '',
    kitta: '',
    buyPrice: '',
    sellPrice: '',
    buyDate: '',
    sellDate: '',
    bonusShares: '',
    cashDividend: '',
    securityType: 'equity',
  })
  const [result, setResult] = useState(null)
  const [holdingPeriod, setHoldingPeriod] = useState(null)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  useEffect(() => {
    if (form.buyDate && form.sellDate) {
      const days = Math.ceil((new Date(form.sellDate) - new Date(form.buyDate)) / (1000 * 60 * 60 * 24))
      setHoldingPeriod(days)
    }
  }, [form.buyDate, form.sellDate])

  const calculate = () => {
    const kitta = parseFloat(form.kitta) || 0
    const buyPrice = parseFloat(form.buyPrice) || 0
    const sellPrice = parseFloat(form.sellPrice) || 0
    const bonusShares = parseFloat(form.bonusShares) || 0
    const cashDiv = parseFloat(form.cashDividend) || 0

    if (!kitta || !buyPrice || !sellPrice) return

    // Adjust for bonus shares
    const totalShares = kitta + bonusShares
    const adjustedCostPerShare = bonusShares > 0
      ? (kitta * buyPrice) / totalShares
      : buyPrice

    const buyAmount = kitta * buyPrice
    const sellAmount = totalShares * sellPrice

    // Buy charges
    const buyBroker = getBrokerCommission(buyAmount)
    const buySebon = getSEBON(buyAmount)
    const buyDp = getDP()
    const totalBuyCharges = buyBroker + buySebon + buyDp

    // Sell charges
    const sellBroker = getBrokerCommission(sellAmount)
    const sellSebon = getSEBON(sellAmount)
    const sellDp = getDP()

    // Capital gain
    const isLongTerm = holdingPeriod ? holdingPeriod >= 365 : false
    const capitalGain = sellAmount - buyAmount - totalBuyCharges
    const cgt = getCGT(capitalGain, isLongTerm)

    const totalSellCharges = sellBroker + sellSebon + sellDp + cgt
    const totalCharges = totalBuyCharges + totalSellCharges

    const grossProfit = sellAmount - buyAmount
    const netProfit = grossProfit + cashDiv - totalCharges
    const netProfitPct = ((netProfit / buyAmount) * 100)
    const breakEven = (buyAmount + totalBuyCharges + sellBroker + sellSebon + sellDp) / totalShares

    setResult({
      kitta, totalShares, buyPrice, sellPrice,
      adjustedCostPerShare: adjustedCostPerShare.toFixed(2),
      buyAmount, sellAmount,
      buyBroker, buySebon, buyDp, totalBuyCharges,
      sellBroker, sellSebon, sellDp, cgt,
      totalSellCharges, totalCharges,
      grossProfit, netProfit, netProfitPct,
      cashDiv, breakEven: breakEven.toFixed(2),
      isLongTerm, holdingPeriod,
      pieData: [
        { name: 'Buy Broker', value: Math.round(buyBroker) },
        { name: 'Sell Broker', value: Math.round(sellBroker) },
        { name: 'SEBON', value: Math.round(buySebon + sellSebon) },
        { name: 'DP Charges', value: Math.round(buyDp + sellDp) },
        { name: 'Capital Gain Tax', value: Math.round(cgt) },
      ],
      chartData: [
        { name: 'Buy Amount', value: Math.round(buyAmount) },
        { name: 'Gross Profit', value: Math.round(grossProfit) },
        { name: 'Total Charges', value: Math.round(totalCharges) },
        { name: 'Net Profit', value: Math.round(netProfit) },
      ]
    })
  }

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🇳🇵</span> NEPSE Trade Details
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Symbol</label>
            <input type="text" value={form.symbol} onChange={e => update('symbol', e.target.value.toUpperCase())} placeholder="e.g. NTC" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Security Type</label>
            <select value={form.securityType} onChange={e => update('securityType', e.target.value)} className={inputClass}>
              <option value="equity">Equity (Shares)</option>
              <option value="bond">Bond/Debenture</option>
              <option value="mutual">Mutual Fund</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Kitta (Units)</label>
            <input type="number" value={form.kitta} onChange={e => update('kitta', e.target.value)} placeholder="e.g. 100" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Buy Price (Rs.)</label>
            <input type="number" value={form.buyPrice} onChange={e => update('buyPrice', e.target.value)} placeholder="e.g. 800" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sell Price (Rs.)</label>
            <input type="number" value={form.sellPrice} onChange={e => update('sellPrice', e.target.value)} placeholder="e.g. 950" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bonus Shares <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={form.bonusShares} onChange={e => update('bonusShares', e.target.value)} placeholder="e.g. 10" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cash Dividend (Rs.) <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={form.cashDividend} onChange={e => update('cashDividend', e.target.value)} placeholder="e.g. 500" className={inputClass} />
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mb-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Holding Period (for CGT)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Buy Date <span className="text-gray-400 font-normal">optional</span></label>
              <input type="date" value={form.buyDate} onChange={e => update('buyDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sell Date <span className="text-gray-400 font-normal">optional</span></label>
              <input type="date" value={form.sellDate} onChange={e => update('sellDate', e.target.value)} className={inputClass} />
            </div>
          </div>
          {holdingPeriod !== null && (
            <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between ${
              holdingPeriod >= 365
                ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300'
                : 'bg-orange-50 dark:bg-orange-900 text-orange-600 dark:text-orange-300'
            }`}>
              <span>📅 {holdingPeriod} days holding period</span>
              <span>{holdingPeriod >= 365 ? '✅ Long-term (5% CGT)' : '⚡ Short-term (7.5% CGT)'}</span>
            </div>
          )}
          {!form.buyDate && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => setHoldingPeriod(400)} className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${holdingPeriod === 400 ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-green-400'}`}>
                ✅ Long-term (≥1yr)
              </button>
              <button onClick={() => setHoldingPeriod(100)} className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${holdingPeriod === 100 ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-orange-400'}`}>
                ⚡ Short-term (&lt;1yr)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={calculate}
          disabled={!form.kitta || !form.buyPrice || !form.sellPrice}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Calculate
        </button>
      </div>

      {/* Result Card */}
      <div>
        {!result ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">🧮</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Fill in the details and click Calculate</p>
            <p className="text-gray-400 text-xs mt-1">Get full breakdown of charges, tax and net profit</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Card */}
            <div className={`rounded-2xl p-5 border shadow-sm ${
              result.netProfit >= 0
                ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {form.symbol || 'Trade'} · {result.totalShares} shares
                    {result.holdingPeriod !== null && ` · ${result.holdingPeriod} days`}
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${result.netProfit >= 0 ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                    {result.netProfit >= 0 ? '+' : ''}Rs.{Math.round(result.netProfit).toLocaleString()}
                  </p>
                  <p className={`text-sm font-medium ${result.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {result.netProfitPct >= 0 ? '+' : ''}{result.netProfitPct.toFixed(2)}% return
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Break-even Price</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Rs.{result.breakEven}</p>
                  {result.bonusShares > 0 && (
                    <p className="text-xs text-blue-500">Adj. cost: Rs.{result.adjustedCostPerShare}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Buy Amount', value: `Rs.${Math.round(result.buyAmount).toLocaleString()}`, color: 'text-gray-700 dark:text-gray-200' },
                  { label: 'Sell Amount', value: `Rs.${Math.round(result.sellAmount).toLocaleString()}`, color: 'text-gray-700 dark:text-gray-200' },
                  { label: 'Total Charges', value: `Rs.${Math.round(result.totalCharges).toLocaleString()}`, color: 'text-red-500' },
                ].map((s, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 bg-opacity-60 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charges Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Charges Breakdown</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
                {[
                  { label: 'Buy Broker Commission', value: result.buyBroker },
                  { label: 'Buy SEBON Fee', value: result.buySebon },
                  { label: 'Buy DP Charge', value: result.buyDp },
                  { label: 'Sell Broker Commission', value: result.sellBroker },
                  { label: 'Sell SEBON Fee', value: result.sellSebon },
                  { label: 'Sell DP Charge', value: result.sellDp },
                  { label: `CGT (${result.isLongTerm ? '5%' : '7.5%'} ${result.isLongTerm ? 'Long' : 'Short'}-term)`, value: result.cgt, highlight: true },
                  result.cashDiv > 0 && { label: 'Cash Dividend', value: result.cashDiv, positive: true },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                    <span className={`text-xs font-semibold ${item.positive ? 'text-green-500' : item.highlight ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                      {item.positive ? '+' : '-'}Rs.{Math.round(item.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pie Chart */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Charges Distribution</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={result.pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                      {result.pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 flex-1">
                  {result.pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.name}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Rs.{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── POSITION & RISK CALCULATOR ────────────────────────────
function PositionCalculator() {
  const [form, setForm] = useState({
    capital: '', riskPct: '2', entryPrice: '', slPrice: '', tpPrice: ''
  })
  const [result, setResult] = useState(null)

  const calculate = () => {
    const capital = parseFloat(form.capital) || 0
    const riskPct = parseFloat(form.riskPct) || 2
    const entry = parseFloat(form.entryPrice) || 0
    const sl = parseFloat(form.slPrice) || 0
    const tp = parseFloat(form.tpPrice) || 0
    if (!capital || !entry || !sl) return

    const riskAmount = (capital * riskPct) / 100
    const riskPerShare = Math.abs(entry - sl)
    const positionSize = Math.floor(riskAmount / riskPerShare)
    const positionValue = positionSize * entry
    const reward = tp ? Math.abs(tp - entry) * positionSize : null
    const rr = tp ? (Math.abs(tp - entry) / riskPerShare).toFixed(2) : null
    const maxLoss = riskPerShare * positionSize
    const potentialGain = reward

    const chartData = []
    for (let r = 0.5; r <= 5; r += 0.5) {
      chartData.push({
        rr: `1:${r}`,
        gain: Math.round(riskAmount * r),
        loss: Math.round(maxLoss)
      })
    }

    setResult({ riskAmount, riskPerShare, positionSize, positionValue, reward, rr, maxLoss, potentialGain, chartData })
  }

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>⚖️</span> Position Size & Risk/Reward
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Total Capital (Rs.)</label>
            <input type="number" value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} placeholder="e.g. 100000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Risk % per Trade</label>
            <input type="number" value={form.riskPct} onChange={e => setForm(p => ({ ...p, riskPct: e.target.value }))} placeholder="e.g. 2" className={inputClass} />
            <p className="text-xs text-gray-400 mt-1">Recommended: 1-2%</p>
          </div>
          <div>
            <label className={labelClass}>Entry Price (Rs.)</label>
            <input type="number" value={form.entryPrice} onChange={e => setForm(p => ({ ...p, entryPrice: e.target.value }))} placeholder="e.g. 500" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Stop Loss (Rs.)</label>
            <input type="number" value={form.slPrice} onChange={e => setForm(p => ({ ...p, slPrice: e.target.value }))} placeholder="e.g. 470" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Take Profit (Rs.) <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={form.tpPrice} onChange={e => setForm(p => ({ ...p, tpPrice: e.target.value }))} placeholder="e.g. 560" className={inputClass} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.capital || !form.entryPrice || !form.slPrice} className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
          Calculate
        </button>
      </div>

      <div>
        {!result ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">⚖️</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Enter your trade details to calculate position size</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Position Size', value: `${result.positionSize} shares`, color: 'text-blue-500' },
                  { label: 'Position Value', value: `Rs.${Math.round(result.positionValue).toLocaleString()}`, color: 'text-gray-900 dark:text-white' },
                  { label: 'Max Risk', value: `-Rs.${Math.round(result.maxLoss).toLocaleString()}`, color: 'text-red-500' },
                  { label: 'Risk Amount', value: `Rs.${Math.round(result.riskAmount).toLocaleString()}`, color: 'text-orange-500' },
                  { label: 'Risk per Share', value: `Rs.${result.riskPerShare.toFixed(2)}`, color: 'text-gray-700 dark:text-gray-200' },
                  result.rr && { label: 'Risk:Reward', value: `1:${result.rr}`, color: parseFloat(result.rr) >= 2 ? 'text-green-500' : 'text-orange-500' },
                  result.potentialGain && { label: 'Potential Gain', value: `+Rs.${Math.round(result.potentialGain).toLocaleString()}`, color: 'text-green-500' },
                ].filter(Boolean).map((s, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gain vs Risk at Different R:R</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={result.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="rr" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => `Rs.${val.toLocaleString()}`} />
                  <Bar dataKey="gain" fill="#22c55e" radius={[4,4,0,0]} name="Potential Gain" />
                  <Bar dataKey="loss" fill="#ef4444" radius={[4,4,0,0]} name="Max Loss" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PERFORMANCE CALCULATOR ────────────────────────────────
function PerformanceCalculator() {
  const [form, setForm] = useState({
    totalTrades: '', winRate: '', avgWin: '', avgLoss: '', capital: '', riskPct: '2'
  })
  const [result, setResult] = useState(null)

  const calculate = () => {
    const trades = parseFloat(form.totalTrades) || 0
    const wr = parseFloat(form.winRate) / 100 || 0
    const avgWin = parseFloat(form.avgWin) || 0
    const avgLoss = parseFloat(form.avgLoss) || 0
    const capital = parseFloat(form.capital) || 0
    const riskPct = parseFloat(form.riskPct) / 100 || 0.02
    if (!trades || !wr || !avgWin || !avgLoss) return

    const expectancy = (wr * avgWin) - ((1 - wr) * avgLoss)
    const rr = (avgWin / avgLoss).toFixed(2)
    const wins = Math.round(trades * wr)
    const losses = trades - wins
    const totalPnl = (wins * avgWin) - (losses * avgLoss)
    const breakEvenWR = (avgLoss / (avgWin + avgLoss) * 100).toFixed(2)

    // Risk of Ruin (simplified)
    const edge = wr - (1 - wr) * (avgLoss / avgWin)
    const ror = edge > 0 ? Math.max(0, ((1 - edge) / (1 + edge)) ** (capital / (capital * riskPct)) * 100) : 100

    // Drawdown simulation
    const chartData = []
    let equity = capital || 10000
    let peak = equity
    let maxDD = 0
    for (let i = 0; i < Math.min(trades, 50); i++) {
      const isWin = Math.random() < wr
      equity += isWin ? avgWin : -avgLoss
      if (equity > peak) peak = equity
      const dd = ((peak - equity) / peak) * 100
      if (dd > maxDD) maxDD = dd
      chartData.push({ trade: i + 1, equity: Math.round(equity), drawdown: -dd.toFixed(2) })
    }

    setResult({ expectancy, rr, wins, losses, totalPnl, breakEvenWR, ror, maxDD: maxDD.toFixed(2), chartData })
  }

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📊</span> Performance Analytics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Total Trades</label>
            <input type="number" value={form.totalTrades} onChange={e => setForm(p => ({ ...p, totalTrades: e.target.value }))} placeholder="e.g. 50" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Win Rate %</label>
            <input type="number" value={form.winRate} onChange={e => setForm(p => ({ ...p, winRate: e.target.value }))} placeholder="e.g. 55" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Avg Win (Rs.)</label>
            <input type="number" value={form.avgWin} onChange={e => setForm(p => ({ ...p, avgWin: e.target.value }))} placeholder="e.g. 1500" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Avg Loss (Rs.)</label>
            <input type="number" value={form.avgLoss} onChange={e => setForm(p => ({ ...p, avgLoss: e.target.value }))} placeholder="e.g. 800" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Capital (Rs.) <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} placeholder="e.g. 100000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Risk % per Trade</label>
            <input type="number" value={form.riskPct} onChange={e => setForm(p => ({ ...p, riskPct: e.target.value }))} placeholder="e.g. 2" className={inputClass} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.totalTrades || !form.winRate || !form.avgWin || !form.avgLoss} className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
          Analyze
        </button>
      </div>

      <div>
        {!result ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Enter your trading stats to analyze performance</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Expectancy', value: `${result.expectancy >= 0 ? '+' : ''}Rs.${Math.round(result.expectancy)}`, color: result.expectancy >= 0 ? 'text-green-500' : 'text-red-500' },
                  { label: 'Risk:Reward', value: `1:${result.rr}`, color: parseFloat(result.rr) >= 1.5 ? 'text-green-500' : 'text-orange-500' },
                  { label: 'Total P&L', value: `${result.totalPnl >= 0 ? '+' : ''}Rs.${Math.round(result.totalPnl).toLocaleString()}`, color: result.totalPnl >= 0 ? 'text-green-500' : 'text-red-500' },
                  { label: 'Break-even WR', value: `${result.breakEvenWR}%`, color: 'text-blue-500' },
                  { label: 'Max Drawdown', value: `-${result.maxDD}%`, color: 'text-red-500' },
                  { label: 'Risk of Ruin', value: `${result.ror.toFixed(1)}%`, color: result.ror < 5 ? 'text-green-500' : result.ror < 20 ? 'text-orange-500' : 'text-red-500' },
                  { label: 'Wins / Losses', value: `${result.wins} / ${result.losses}`, color: 'text-gray-700 dark:text-gray-200' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Simulated Equity Curve</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={result.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="trade" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => `Rs.${val?.toLocaleString?.() ?? val}`} />
                  <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Equity" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SIP CALCULATOR ─────────────────────────────────────────
function SIPCalculator() {
  const [form, setForm] = useState({
    monthly: '', annualReturn: '12', years: '10', initialLump: ''
  })
  const [result, setResult] = useState(null)

  const calculate = () => {
    const monthly = parseFloat(form.monthly) || 0
    const rate = (parseFloat(form.annualReturn) || 12) / 100 / 12
    const months = (parseFloat(form.years) || 10) * 12
    const lump = parseFloat(form.initialLump) || 0
    if (!monthly) return

    const sipValue = monthly * ((Math.pow(1 + rate, months) - 1) / rate) * (1 + rate)
    const lumpValue = lump * Math.pow(1 + rate * 12, parseFloat(form.years))
    const totalValue = sipValue + lumpValue
    const totalInvested = monthly * months + lump
    const totalGain = totalValue - totalInvested

    const chartData = []
    for (let y = 1; y <= parseFloat(form.years); y++) {
      const m = y * 12
      const sv = monthly * ((Math.pow(1 + rate, m) - 1) / rate) * (1 + rate)
      const lv = lump * Math.pow(1 + rate * 12, y)
      chartData.push({
        year: `Yr ${y}`,
        invested: Math.round(monthly * m + lump),
        value: Math.round(sv + lv)
      })
    }

    setResult({ totalValue, totalInvested, totalGain, gainPct: ((totalGain / totalInvested) * 100).toFixed(1), chartData })
  }

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  const labelClass = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>💰</span> SIP — Systematic Investment Plan
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Monthly Investment (Rs.)</label>
            <input type="number" value={form.monthly} onChange={e => setForm(p => ({ ...p, monthly: e.target.value }))} placeholder="e.g. 5000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Expected Annual Return %</label>
            <input type="number" value={form.annualReturn} onChange={e => setForm(p => ({ ...p, annualReturn: e.target.value }))} placeholder="e.g. 12" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Investment Period (Years)</label>
            <input type="number" value={form.years} onChange={e => setForm(p => ({ ...p, years: e.target.value }))} placeholder="e.g. 10" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Initial Lump Sum (Rs.) <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={form.initialLump} onChange={e => setForm(p => ({ ...p, initialLump: e.target.value }))} placeholder="e.g. 50000" className={inputClass} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.monthly} className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
          Calculate Growth
        </button>
      </div>

      <div>
        {!result ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">💰</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Enter your SIP details to see growth projection</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Total Value', value: `Rs.${Math.round(result.totalValue).toLocaleString()}`, color: 'text-green-500' },
                { label: 'Total Invested', value: `Rs.${Math.round(result.totalInvested).toLocaleString()}`, color: 'text-blue-500' },
                { label: 'Total Gain', value: `+Rs.${Math.round(result.totalGain).toLocaleString()}`, color: 'text-green-500' },
                { label: 'Return', value: `+${result.gainPct}%`, color: 'text-green-500' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Growth Projection</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={result.chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/1000)}K`} />
                <Tooltip formatter={(val) => `Rs.${val.toLocaleString()}`} />
                <Line type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} dot={false} name="Invested" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} name="Portfolio Value" />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────
function RiskLabPage() {
  const [activeTab, setActiveTab] = useState('nepse')

  return (
    <div className="w-full px-6 py-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ⚗️ Risk Lab
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Calculate before you trade — position sizing, NEPSE charges, performance analytics & SIP
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300 text-gray-700 dark:text-gray-300'
            }`}
          >
            <p className="text-base font-semibold">{tab.label}</p>
            <p className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-blue-200' : 'text-gray-400'}`}>
              {tab.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'nepse' && <NEPSECalculator />}
      {activeTab === 'position' && <PositionCalculator />}
      {activeTab === 'performance' && <PerformanceCalculator />}
      {activeTab === 'sip' && <SIPCalculator />}

    </div>
  )
}

export default RiskLabPage
