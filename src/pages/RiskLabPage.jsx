import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
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

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6']

const TABS = [
  { id: 'nepse',       label: 'NEPSE Calc',   desc: 'Trade Calculator' },
  { id: 'position',   label: 'Position',      desc: 'Size & Risk/Reward' },
  { id: 'performance',label: 'Performance',   desc: 'Win Rate & Drawdown' },
  { id: 'sip',        label: 'SIP',           desc: 'Systematic Investment' },
]

const INPUT = "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-100 focus:border-blue-400 rounded-xl px-3 py-2 w-full outline-none placeholder-gray-300 dark:placeholder-gray-600"
const LABEL = "block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1"

// ─── Stat Mini Card ─────────────────────────────────────────
function StatCard({ label, value, color = 'text-gray-800 dark:text-gray-100' }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className={`text-[13px] font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────
function EmptyState({ text }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center h-full">
      <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-[11px] text-gray-400">{text}</p>
    </div>
  )
}

// ─── NEPSE CALCULATOR ──────────────────────────────────────
function NEPSECalculator() {
  const [form, setForm] = useState({
    symbol: '', kitta: '', buyPrice: '', sellPrice: '',
    buyDate: '', sellDate: '', bonusShares: '', cashDividend: '', securityType: 'equity',
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

    const totalShares = kitta + bonusShares
    const adjustedCostPerShare = bonusShares > 0 ? (kitta * buyPrice) / totalShares : buyPrice
    const buyAmount = kitta * buyPrice
    const sellAmount = totalShares * sellPrice

    const buyBroker = getBrokerCommission(buyAmount)
    const buySebon = getSEBON(buyAmount)
    const buyDp = getDP()
    const totalBuyCharges = buyBroker + buySebon + buyDp

    const sellBroker = getBrokerCommission(sellAmount)
    const sellSebon = getSEBON(sellAmount)
    const sellDp = getDP()
    const isLongTerm = holdingPeriod ? holdingPeriod >= 365 : false
    const capitalGain = sellAmount - buyAmount - totalBuyCharges
    const cgt = getCGT(capitalGain, isLongTerm)
    const totalSellCharges = sellBroker + sellSebon + sellDp + cgt
    const totalCharges = totalBuyCharges + totalSellCharges
    const grossProfit = sellAmount - buyAmount
    const netProfit = grossProfit + cashDiv - totalCharges
    const netProfitPct = (netProfit / buyAmount) * 100
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
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Input */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">NEPSE Trade Details</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Symbol</label>
            <input type="text" value={form.symbol} onChange={e => update('symbol', e.target.value.toUpperCase())} placeholder="e.g. NTC" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Security Type</label>
            <select value={form.securityType} onChange={e => update('securityType', e.target.value)} className={INPUT}>
              <option value="equity">Equity (Shares)</option>
              <option value="bond">Bond/Debenture</option>
              <option value="mutual">Mutual Fund</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Kitta (Units)</label>
            <input type="number" value={form.kitta} onChange={e => update('kitta', e.target.value)} placeholder="100" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Buy Price (Rs.)</label>
            <input type="number" value={form.buyPrice} onChange={e => update('buyPrice', e.target.value)} placeholder="800" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Sell Price (Rs.)</label>
            <input type="number" value={form.sellPrice} onChange={e => update('sellPrice', e.target.value)} placeholder="950" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Bonus Shares <span className="normal-case font-normal text-gray-300">opt.</span></label>
            <input type="number" value={form.bonusShares} onChange={e => update('bonusShares', e.target.value)} placeholder="10" className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Cash Dividend (Rs.) <span className="normal-case font-normal text-gray-300">opt.</span></label>
            <input type="number" value={form.cashDividend} onChange={e => update('cashDividend', e.target.value)} placeholder="500" className={INPUT} />
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Holding Period (CGT)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Buy Date <span className="normal-case font-normal text-gray-300">opt.</span></label>
              <input type="date" value={form.buyDate} onChange={e => update('buyDate', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Sell Date <span className="normal-case font-normal text-gray-300">opt.</span></label>
              <input type="date" value={form.sellDate} onChange={e => update('sellDate', e.target.value)} className={INPUT} />
            </div>
          </div>

          {holdingPeriod !== null && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-medium ${
              holdingPeriod >= 365
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900'
            }`}>
              <span>{holdingPeriod} days</span>
              <span>{holdingPeriod >= 365 ? 'Long-term · 5% CGT' : 'Short-term · 7.5% CGT'}</span>
            </div>
          )}

          {!form.buyDate && (
            <div className="flex gap-2">
              <button onClick={() => setHoldingPeriod(400)} className={`flex-1 py-1.5 rounded-xl text-[10px] font-semibold border transition-colors ${holdingPeriod === 400 ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-emerald-400'}`}>
                Long-term (≥1yr)
              </button>
              <button onClick={() => setHoldingPeriod(100)} className={`flex-1 py-1.5 rounded-xl text-[10px] font-semibold border transition-colors ${holdingPeriod === 100 ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400'}`}>
                Short-term (&lt;1yr)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={calculate}
          disabled={!form.kitta || !form.buyPrice || !form.sellPrice}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-colors"
        >
          Calculate
        </button>
      </div>

      {/* Result */}
      <div>
        {!result ? (
          <EmptyState text="Fill in the details and click Calculate" />
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className={`rounded-2xl p-4 border ${
              result.netProfit >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900'
                : 'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] text-gray-400">{form.symbol || 'Trade'} · {result.totalShares} shares{result.holdingPeriod !== null ? ` · ${result.holdingPeriod}d` : ''}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${result.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {result.netProfit >= 0 ? '+' : ''}Rs.{Math.round(result.netProfit).toLocaleString()}
                  </p>
                  <p className={`text-[11px] font-semibold ${result.netProfit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {result.netProfitPct >= 0 ? '+' : ''}{result.netProfitPct.toFixed(2)}% return
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-gray-400">Break-even</p>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-100 mt-0.5">Rs.{result.breakEven}</p>
                  {result.bonusShares > 0 && (
                    <p className="text-[10px] text-blue-400">Adj. Rs.{result.adjustedCostPerShare}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Buy', value: `Rs.${Math.round(result.buyAmount).toLocaleString()}` },
                  { label: 'Sell', value: `Rs.${Math.round(result.sellAmount).toLocaleString()}` },
                  { label: 'Charges', value: `Rs.${Math.round(result.totalCharges).toLocaleString()}`, red: true },
                ].map((s, i) => (
                  <div key={i} className="bg-white/60 dark:bg-gray-900/60 rounded-xl p-2 text-center border border-white/50 dark:border-gray-800/50">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${s.red ? 'text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charges breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Charges Breakdown</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Buy Broker Commission', value: result.buyBroker },
                  { label: 'Buy SEBON Fee', value: result.buySebon },
                  { label: 'Buy DP Charge', value: result.buyDp },
                  { label: 'Sell Broker Commission', value: result.sellBroker },
                  { label: 'Sell SEBON Fee', value: result.sellSebon },
                  { label: 'Sell DP Charge', value: result.sellDp },
                  { label: `CGT (${result.isLongTerm ? '5% Long' : '7.5% Short'}-term)`, value: result.cgt, highlight: true },
                  result.cashDiv > 0 && { label: 'Cash Dividend', value: result.cashDiv, positive: true },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{item.label}</span>
                    <span className={`text-[10px] font-semibold ${item.positive ? 'text-emerald-500' : item.highlight ? 'text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {item.positive ? '+' : '-'}Rs.{Math.round(item.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Charges Distribution</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={result.pieData} cx={45} cy={45} innerRadius={25} outerRadius={45} dataKey="value">
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
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">Rs.{item.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
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
      chartData.push({ rr: `1:${r}`, gain: Math.round(riskAmount * r), loss: Math.round(maxLoss) })
    }

    setResult({ riskAmount, riskPerShare, positionSize, positionValue, reward, rr, maxLoss, potentialGain, chartData })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Position Size & Risk/Reward</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={LABEL}>Total Capital (Rs.)</label>
            <input type="number" value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} placeholder="100000" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Risk % per Trade</label>
            <input type="number" value={form.riskPct} onChange={e => setForm(p => ({ ...p, riskPct: e.target.value }))} placeholder="2" className={INPUT} />
            <p className="text-[9px] text-gray-400 mt-1">Recommended: 1–2%</p>
          </div>
          <div>
            <label className={LABEL}>Entry Price (Rs.)</label>
            <input type="number" value={form.entryPrice} onChange={e => setForm(p => ({ ...p, entryPrice: e.target.value }))} placeholder="500" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Stop Loss (Rs.)</label>
            <input type="number" value={form.slPrice} onChange={e => setForm(p => ({ ...p, slPrice: e.target.value }))} placeholder="470" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Take Profit <span className="normal-case font-normal text-gray-300">opt.</span></label>
            <input type="number" value={form.tpPrice} onChange={e => setForm(p => ({ ...p, tpPrice: e.target.value }))} placeholder="560" className={INPUT} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.capital || !form.entryPrice || !form.slPrice} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-colors">
          Calculate
        </button>
      </div>

      <div>
        {!result ? (
          <EmptyState text="Enter your trade details to calculate position size" />
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Position Size" value={`${result.positionSize} shares`} color="text-blue-500" />
              <StatCard label="Position Value" value={`Rs.${Math.round(result.positionValue).toLocaleString()}`} />
              <StatCard label="Max Risk" value={`-Rs.${Math.round(result.maxLoss).toLocaleString()}`} color="text-red-400" />
              <StatCard label="Risk Amount" value={`Rs.${Math.round(result.riskAmount).toLocaleString()}`} color="text-amber-500" />
              <StatCard label="Risk per Share" value={`Rs.${result.riskPerShare.toFixed(2)}`} />
              {result.rr && <StatCard label="Risk:Reward" value={`1:${result.rr}`} color={parseFloat(result.rr) >= 2 ? 'text-emerald-500' : 'text-amber-500'} />}
              {result.potentialGain && <StatCard label="Potential Gain" value={`+Rs.${Math.round(result.potentialGain).toLocaleString()}`} color="text-emerald-500" />}
            </div>

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Gain vs Risk at Different R:R</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={result.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" className="dark:stroke-gray-800" />
                  <XAxis dataKey="rr" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(val) => `Rs.${val.toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="gain" fill="#10b981" radius={[4,4,0,0]} name="Potential Gain" />
                  <Bar dataKey="loss" fill="#f87171" radius={[4,4,0,0]} name="Max Loss" />
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
    const edge = wr - (1 - wr) * (avgLoss / avgWin)
    const ror = edge > 0 ? Math.max(0, ((1 - edge) / (1 + edge)) ** (capital / (capital * riskPct)) * 100) : 100

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Performance Analytics</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Total Trades</label>
            <input type="number" value={form.totalTrades} onChange={e => setForm(p => ({ ...p, totalTrades: e.target.value }))} placeholder="50" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Win Rate %</label>
            <input type="number" value={form.winRate} onChange={e => setForm(p => ({ ...p, winRate: e.target.value }))} placeholder="55" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Avg Win (Rs.)</label>
            <input type="number" value={form.avgWin} onChange={e => setForm(p => ({ ...p, avgWin: e.target.value }))} placeholder="1500" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Avg Loss (Rs.)</label>
            <input type="number" value={form.avgLoss} onChange={e => setForm(p => ({ ...p, avgLoss: e.target.value }))} placeholder="800" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Capital <span className="normal-case font-normal text-gray-300">opt.</span></label>
            <input type="number" value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} placeholder="100000" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Risk % per Trade</label>
            <input type="number" value={form.riskPct} onChange={e => setForm(p => ({ ...p, riskPct: e.target.value }))} placeholder="2" className={INPUT} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.totalTrades || !form.winRate || !form.avgWin || !form.avgLoss} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-colors">
          Analyze
        </button>
      </div>

      <div>
        {!result ? (
          <EmptyState text="Enter your trading stats to analyze performance" />
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Expectancy" value={`${result.expectancy >= 0 ? '+' : ''}Rs.${Math.round(result.expectancy)}`} color={result.expectancy >= 0 ? 'text-emerald-500' : 'text-red-400'} />
              <StatCard label="Risk:Reward" value={`1:${result.rr}`} color={parseFloat(result.rr) >= 1.5 ? 'text-emerald-500' : 'text-amber-500'} />
              <StatCard label="Total P&L" value={`${result.totalPnl >= 0 ? '+' : ''}Rs.${Math.round(result.totalPnl).toLocaleString()}`} color={result.totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400'} />
              <StatCard label="Break-even WR" value={`${result.breakEvenWR}%`} color="text-blue-500" />
              <StatCard label="Max Drawdown" value={`-${result.maxDD}%`} color="text-red-400" />
              <StatCard label="Risk of Ruin" value={`${result.ror.toFixed(1)}%`} color={result.ror < 5 ? 'text-emerald-500' : result.ror < 20 ? 'text-amber-500' : 'text-red-400'} />
              <StatCard label="Wins / Losses" value={`${result.wins} / ${result.losses}`} />
            </div>

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Simulated Equity Curve</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={result.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" className="dark:stroke-gray-800" />
                  <XAxis dataKey="trade" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(val) => `Rs.${val?.toLocaleString?.() ?? val}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
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
      chartData.push({ year: `Yr ${y}`, invested: Math.round(monthly * m + lump), value: Math.round(sv + lv) })
    }

    setResult({ totalValue, totalInvested, totalGain, gainPct: ((totalGain / totalInvested) * 100).toFixed(1), chartData })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Systematic Investment Plan</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={LABEL}>Monthly Investment (Rs.)</label>
            <input type="number" value={form.monthly} onChange={e => setForm(p => ({ ...p, monthly: e.target.value }))} placeholder="5000" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Annual Return %</label>
            <input type="number" value={form.annualReturn} onChange={e => setForm(p => ({ ...p, annualReturn: e.target.value }))} placeholder="12" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Period (Years)</label>
            <input type="number" value={form.years} onChange={e => setForm(p => ({ ...p, years: e.target.value }))} placeholder="10" className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Initial Lump Sum <span className="normal-case font-normal text-gray-300">opt.</span></label>
            <input type="number" value={form.initialLump} onChange={e => setForm(p => ({ ...p, initialLump: e.target.value }))} placeholder="50000" className={INPUT} />
          </div>
        </div>
        <button onClick={calculate} disabled={!form.monthly} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-colors">
          Calculate Growth
        </button>
      </div>

      <div>
        {!result ? (
          <EmptyState text="Enter your SIP details to see growth projection" />
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total Value" value={`Rs.${Math.round(result.totalValue).toLocaleString()}`} color="text-emerald-500" />
              <StatCard label="Total Invested" value={`Rs.${Math.round(result.totalInvested).toLocaleString()}`} color="text-blue-500" />
              <StatCard label="Total Gain" value={`+Rs.${Math.round(result.totalGain).toLocaleString()}`} color="text-emerald-500" />
              <StatCard label="Return" value={`+${result.gainPct}%`} color="text-emerald-500" />
            </div>

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Growth Projection</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={result.chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" className="dark:stroke-gray-800" />
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v/1000)}K`} />
                  <Tooltip formatter={(val) => `Rs.${val.toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} dot={false} name="Invested" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} name="Portfolio Value" />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────
function RiskLabPage() {
  const [activeTab, setActiveTab] = useState('nepse')
  const { t } = useLanguage()

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6 pb-10 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{t('risklab.title')}</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">{t('risklab.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-1 border border-gray-100 dark:border-gray-800">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 px-2 rounded-xl transition-all text-center ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-none'
                : 'hover:bg-white/60 dark:hover:bg-gray-800'
            }`}
          >
            <span className={`text-[11px] font-semibold leading-tight ${activeTab === tab.id ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
              {tab.label}
            </span>
            <span className={`text-[9px] mt-0.5 hidden sm:block ${activeTab === tab.id ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'nepse'       && <NEPSECalculator />}
      {activeTab === 'position'    && <PositionCalculator />}
      {activeTab === 'performance' && <PerformanceCalculator />}
      {activeTab === 'sip'         && <SIPCalculator />}

    </div>
  )
}

export default RiskLabPage
