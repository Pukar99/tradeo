// === AdminPage.jsx ===
import { useState } from 'react'
import UsersTab from '../components/admin/UsersTab'
import ContentTab from '../components/admin/ContentTab'
import SystemTab from '../components/admin/SystemTab'
import FeatureFlagsTab from '../components/admin/FeatureFlagsTab'
import BroadcastTab from '../components/admin/BroadcastTab'
import AuditLogTab from '../components/admin/AuditLogTab'
import AIUsageTab from '../components/admin/AIUsageTab'
import AnalyticsTab from '../components/admin/AnalyticsTab'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Content' },
  { id: 'system', label: 'System' },
  { id: 'flags', label: 'Feature Flags' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'ai', label: 'AI Usage' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit Log' },
]

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  // Admin was the last tab bar in the app still popping the highlight into
  // place instead of sliding it — Screen, Logs, Data Lab, Explore, RiskLab and
  // IPO all run this hook already.
  const { containerRef, indicatorStyle, onPointerDown } = useSlidingIndicator(tab, setTab)
  // Lifted here (not local to AnalyticsTab) so clicking a user in the Users
  // tab can jump straight to their analytics, pre-selected.
  const [selectedUserId, setSelectedUserId] = useState(null)

  function viewUserAnalytics(userId) {
    setSelectedUserId(userId)
    setTab('analytics')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-[56px]">
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Header. Deliberately neutral chrome — no tier material here: the
            admin panel isn't tier-scoped, so gilding the frame would read as
            a claim about the viewing admin's own tier. Tier colour only
            appears where it describes a specific user's data (see TierBadge). */}
        <div className="flex items-center gap-3 mb-4 px-0.5">
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none">
            <svg
              className="w-[18px] h-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 4 6.5v5c0 4.4 3.2 8.5 8 9.5 4.8-1 8-5.1 8-9.5v-5L12 3Z" />
            </svg>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Control panel
            </p>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
              Admin
            </h1>
          </div>
        </div>

        {/* Tab strip */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm dark:shadow-none">
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 overflow-x-auto overscroll-x-contain">
            <div
              ref={containerRef}
              onPointerDown={onPointerDown}
              className="relative flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit"
            >
              <div
                aria-hidden="true"
                className="absolute top-0 left-0 rounded-md bg-white dark:bg-gray-700 shadow-sm transition-[transform,width,height] duration-300 ease-luxury pointer-events-none"
                style={indicatorStyle}
              />
              {TABS.map((t) => (
                <button
                  key={t.id}
                  data-indicator-active={tab === t.id || undefined}
                  data-indicator-key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative z-10 shrink-0 whitespace-nowrap px-3 py-1.5 text-[10px] font-semibold rounded-md transition-colors ${
                    tab === t.id
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {tab === 'users' && <UsersTab onSelectUser={viewUserAnalytics} />}
          {tab === 'content' && <ContentTab />}
          {tab === 'system' && <SystemTab />}
          {tab === 'flags' && <FeatureFlagsTab />}
          {tab === 'broadcast' && <BroadcastTab />}
          {tab === 'ai' && <AIUsageTab />}
          {tab === 'analytics' && (
            <AnalyticsTab
              selectedUserId={selectedUserId}
              onClearSelectedUser={() => setSelectedUserId(null)}
            />
          )}
          {tab === 'audit' && <AuditLogTab />}
        </div>
      </div>
    </div>
  )
}
