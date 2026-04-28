import { forwardRef } from 'react'

// Equity sparkline as a pure SVG — no Recharts dep, renders correctly in html2canvas
function Sparkline({ equityCurve }) {
  if (!equityCurve || equityCurve.length < 2) return null
  const pts   = equityCurve
  const minV  = Math.min(...pts)
  const maxV  = Math.max(...pts)
  const range = maxV - minV || 1
  const W = 220, H = 44
  const step  = W / Math.max(pts.length - 1, 1)
  const toY   = (v) => H - ((v - minV) / range) * (H - 4) - 2
  const poly  = pts.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const fill  = pts.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const endUp = pts[pts.length - 1] >= 0
  const col   = endUp ? '#10b981' : '#f87171'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="tc-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.4" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${fill} ${((pts.length - 1) * step).toFixed(1)},${H}`}
        fill="url(#tc-spark-grad)"
      />
      <polyline
        points={poly}
        fill="none"
        stroke={col}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Always dark card — theme-independent (for PNG export)
// Uses forwardRef so AuditTab can pass ref for html2canvas capture
const TraderCard = forwardRef(function TraderCard({ kpis, dateLabel, user }, ref) {
  const fmtPnl = (n) =>
    `${n >= 0 ? '+' : '−'}Rs.${Math.abs(Math.round(n)).toLocaleString()}`

  const name    = user?.name || 'Trader'
  const initials = name.split(' ').map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('')
  const avatar  = user?.avatar_url || null

  const winRate = kpis.winRate !== null ? kpis.winRate.toFixed(1) : null
  const pf      = kpis.profitFactor !== null
    ? (kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2))
    : '—'

  return (
    <div
      ref={ref}
      style={{
        width: 400,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        borderRadius: 16,
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Subtle accent glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Top row: logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>T</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em' }}>Tradeo</span>
        </div>
        <span style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Performance Card
        </span>
      </div>

      {/* User row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #334155' }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{name}</p>
          <p style={{ fontSize: 9, color: '#64748b', margin: 0, marginTop: 1 }}>{dateLabel}</p>
        </div>
      </div>

      {/* Big stat highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 16,
      }}>
        {[
          {
            label: 'Net P&L',
            value: fmtPnl(kpis.netPnl),
            color: kpis.netPnl >= 0 ? '#10b981' : '#f87171',
          },
          {
            label: 'Win Rate',
            value: winRate !== null ? `${winRate}%` : '—',
            color: winRate !== null ? (parseFloat(winRate) >= 50 ? '#10b981' : '#f87171') : '#94a3b8',
          },
          {
            label: 'Total Trades',
            value: String(kpis.totalTrades),
            color: '#e2e8f0',
          },
          {
            label: 'Profit Factor',
            value: pf,
            color: kpis.profitFactor !== null
              ? (kpis.profitFactor === Infinity || kpis.profitFactor >= 1.5 ? '#10b981'
                : kpis.profitFactor >= 1 ? '#f59e0b' : '#f87171')
              : '#94a3b8',
          },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: 10,
            padding: '10px 12px',
            border: '1px solid rgba(51,65,85,0.6)',
          }}>
            <p style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              {label}
            </p>
            <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, marginTop: 3, letterSpacing: '-0.02em' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {kpis.equityCurve && kpis.equityCurve.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Equity Curve
          </p>
          <div style={{ background: 'rgba(30,41,59,0.4)', borderRadius: 8, padding: '6px 8px' }}>
            <Sparkline equityCurve={kpis.equityCurve} />
          </div>
        </div>
      )}

      {/* Best / Worst row */}
      {(kpis.bestTrade || kpis.worstTrade) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {kpis.bestTrade && (
            <div style={{
              flex: 1,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8,
              padding: '7px 10px',
            }}>
              <p style={{ fontSize: 8, color: '#10b981', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', margin: '2px 0 0' }}>{kpis.bestTrade.symbol}</p>
              <p style={{ fontSize: 10, color: '#10b981', fontWeight: 700, margin: 0 }}>
                {fmtPnl(parseFloat(kpis.bestTrade.realized_pnl) || 0)}
              </p>
            </div>
          )}
          {kpis.worstTrade && kpis.worstTrade.id !== kpis.bestTrade?.id && (
            <div style={{
              flex: 1,
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8,
              padding: '7px 10px',
            }}>
              <p style={{ fontSize: 8, color: '#f87171', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Worst</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', margin: '2px 0 0' }}>{kpis.worstTrade.symbol}</p>
              <p style={{ fontSize: 10, color: '#f87171', fontWeight: 700, margin: 0 }}>
                {fmtPnl(parseFloat(kpis.worstTrade.realized_pnl) || 0)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(51,65,85,0.5)',
        paddingTop: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, color: '#475569' }}>tradeo-seven.vercel.app</span>
        <span style={{ fontSize: 9, color: '#475569' }}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
})

export default TraderCard
