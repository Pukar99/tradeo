// === SystemTab.jsx ===
import { useState, useEffect } from 'react'
import { getSystemStats, getSystemDbCounts, getSystemConfig, getSystemSymbolHealth, getSystemJournalHealth } from '@api/admin'
import StatsCards from './StatsCards'
import ScraperPanel from './ScraperPanel'
import DbCountsTable from './DbCountsTable'
import ConfigEditor from './ConfigEditor'

export default function SystemTab() {
  const [stats,         setStats]         = useState(null)
  const [statsLoading,  setStatsLoading]  = useState(true)
  const [dbCounts,      setDbCounts]      = useState(null)
  const [dbLoading,     setDbLoading]     = useState(true)
  const [config,        setConfig]        = useState(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [health,        setHealth]        = useState(null)

  useEffect(() => {
    getSystemStats()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))

    getSystemDbCounts()
      .then(({ data }) => setDbCounts(data.tables))
      .catch(() => {})
      .finally(() => setDbLoading(false))

    getSystemConfig()
      .then(({ data }) => setConfig(data.config))
      .catch(() => {})
      .finally(() => setConfigLoading(false))

    // Health checks — non-critical, show inline
    Promise.all([getSystemSymbolHealth(), getSystemJournalHealth()])
      .then(([sym, jrn]) => setHealth({ dangling: sym.data.dangling_count, nullClose: jrn.data.null_nepse_close_last_30d }))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-0">
      {/* Stats cards */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Health row */}
      {health && (
        <div className="flex items-center gap-4 px-4 pb-2">
          <div className={`flex items-center gap-1.5 text-xs ${health.dangling > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.dangling > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
            {health.dangling > 0
              ? `${health.dangling} watchlist symbols missing from company_master`
              : 'All watchlist symbols in company_master'}
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${health.nullClose > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.nullClose > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
            {health.nullClose > 0
              ? `${health.nullClose} market journal rows missing NEPSE close (last 30 days)`
              : 'All market journal rows have NEPSE close'}
          </div>
        </div>
      )}

      {/* Scraper + DB counts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
        <ScraperPanel />
        <DbCountsTable tables={dbCounts} loading={dbLoading} />
      </div>

      {/* Config editor — full width */}
      <div className="px-4 pb-4">
        <ConfigEditor config={config} loading={configLoading} />
      </div>
    </div>
  )
}
