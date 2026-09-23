// === SystemTab.jsx ===
// Visual pass 2026-08-08 (owner picked option B — trim the duplicated stats):
//
// The tab used to open with five large stat tiles and bury the two health
// checks under them in one line of 11px text. Health now leads.
//
// Four of those five tiles were a second rendering of rows already visible in
// the Table Row Counts panel below them (users/research_posts/trade_log/
// market_journal). Only `suspended` was unique — it's a filter, not a table.
// The volume numbers now live once, in the panel built for them.
//
// Scraper status is lifted here from ScraperPanel so the health tile and the
// panel read one poll instead of two. Same endpoints, same 3s-while-running
// cadence as before — ScraperPanel is presentational now.
import { useState, useEffect, useCallback, useRef } from 'react'
// Scraper status stays a direct call — it's polled every 3s while a scrape
// runs, so a TTL cache would freeze the progress readout. Everything else on
// this tab is cached; db-counts especially, at 22 COUNT(*) queries a visit.
import { getSystemScraper, runSystemScraper } from '@api/admin'
import {
  getSystemStats,
  getSystemDbCounts,
  getSystemConfig,
  getSystemSymbolHealth,
  getSystemJournalHealth,
  clearAdminSystemCache,
} from '../../utils/adminCache'
import toast from 'react-hot-toast'
import StatsCards from './StatsCards'
import SystemHealth from './SystemHealth'
import ScraperPanel from './ScraperPanel'
import DbCountsTable from './DbCountsTable'
import ConfigEditor from './ConfigEditor'

export default function SystemTab() {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [dbCounts, setDbCounts] = useState(null)
  const [dbLoading, setDbLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [health, setHealth] = useState(null)

  const [scraper, setScraper] = useState(null)
  const [scraperLoading, setScraperLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const pollRef = useRef(null)

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

    // Health checks — non-critical, surfaced in the status band above.
    // `dangling` (the actual ticker list) rides along with the count in the
    // same response and used to be discarded here.
    Promise.all([getSystemSymbolHealth(), getSystemJournalHealth()])
      .then(([sym, jrn]) =>
        setHealth({
          danglingCount: sym.data.dangling_count,
          danglingList: sym.data.dangling || [],
          nullClose: jrn.data.null_nepse_close_last_30d,
        })
      )
      .catch(() => {})
  }, [])

  const fetchScraper = useCallback(async () => {
    try {
      const { data } = await getSystemScraper()
      setScraper(data)
      return data
    } catch {
      return null
    } finally {
      setScraperLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScraper()
  }, [fetchScraper])

  // Poll every 3s while the scraper is running (unchanged cadence).
  useEffect(() => {
    if (scraper?.running) {
      pollRef.current = setInterval(async () => {
        const s = await fetchScraper()
        if (!s?.running) clearInterval(pollRef.current)
      }, 3000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [scraper?.running, fetchScraper])

  async function handleRunScraper() {
    if (triggering || scraper?.running) return
    setTriggering(true)
    try {
      await runSystemScraper()
      toast.success('Scraper triggered')
      // A scrape changes row counts and both health checks. Drop the cached
      // snapshots so the next visit reflects the new data instead of serving
      // a pre-scrape copy for up to five minutes.
      clearAdminSystemCache()
      await fetchScraper()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to trigger scraper')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="flex flex-col gap-0">
      <SystemHealth scraper={scraper} scraperLoading={scraperLoading} health={health} />

      <StatsCards stats={stats} loading={statsLoading} />

      {/* Scraper + DB counts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
        <ScraperPanel
          status={scraper}
          loading={scraperLoading}
          triggering={triggering}
          onRun={handleRunScraper}
        />
        <DbCountsTable tables={dbCounts} loading={dbLoading} />
      </div>

      {/* Config editor — full width */}
      <div className="px-4 pb-4">
        <ConfigEditor config={config} loading={configLoading} />
      </div>
    </div>
  )
}
