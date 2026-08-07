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
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Control panel</p>
        </div>

        {/* Tab strip */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-3 py-1 border-b border-gray-100 dark:border-gray-800 overflow-x-auto overscroll-x-contain">
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                    tab === t.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
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
