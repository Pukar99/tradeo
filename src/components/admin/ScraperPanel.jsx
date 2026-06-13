// === ScraperPanel.jsx ===
import { useState, useEffect, useRef } from 'react'
import { getSystemScraper, runSystemScraper } from '@api/admin'
import toast from 'react-hot-toast'

export default function ScraperPanel() {
  const [status,   setStatus]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [running,  setRunning]  = useState(false)
  const pollRef = useRef(null)

  async function fetchStatus() {
    try {
      const { data } = await getSystemScraper()
      setStatus(data)
      return data
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }

  // Poll every 3s while scraper is running
  useEffect(() => {
    fetchStatus()
    return () => clearInterval(pollRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status?.running) {
      pollRef.current = setInterval(async () => {
        const s = await fetchStatus()
        if (!s?.running) clearInterval(pollRef.current)
      }, 3000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [status?.running]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRun() {
    if (running || status?.running) return
    setRunning(true)
    try {
      await runSystemScraper()
      toast.success('Scraper triggered')
      await fetchStatus()
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to trigger scraper'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  const lastRun = status?.lastRun
    ? new Date(status.lastRun).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never'

  return (
    <div className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/50">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Scraper</p>
      </div>
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                status?.running
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {status?.running ? 'Running…' : 'Idle'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Last run</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">{lastRun}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Rows saved</span>
              <span className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{status?.rowsInserted ?? 0}</span>
            </div>
            {status?.lastError && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/15 rounded-lg border border-red-100 dark:border-red-800/30">
                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium break-all">{status.lastError}</p>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleRun}
                disabled={running || status?.running}
                className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
              >
                {status?.running ? 'Running…' : 'Run Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
