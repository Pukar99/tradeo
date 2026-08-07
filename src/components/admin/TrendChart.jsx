// === TrendChart.jsx — shared small area-chart trend, used by Analytics + AI Usage tabs ===
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function TrendChart({ data, dataKey, color, isDark, label }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {label}
      </div>
      {data.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          No data yet
        </div>
      ) : (
        <div style={{ width: '100%', height: 96 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{
                  fontSize: 10,
                  background: isDark ? '#1f2937' : '#ffffff',
                  border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  color: isDark ? '#e5e7eb' : '#111827',
                }}
                labelFormatter={(d) => d}
                formatter={(v) => [v, label]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                fill={`url(#grad-${dataKey})`}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
