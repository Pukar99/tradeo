import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { useContextMenu } from '../components/ContextMenu'
import {
  getResearchPosts,
  getResearchEligibility,
  deleteResearchPost,
  verifyResearchPost,
  pinResearchPost,
  getAdminPending
} from '../api'


const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ person, size = 'w-7 h-7' }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {person?.avatar_url && !imgError ? (
        <img
          src={person.avatar_url}
          alt={person.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-white text-[10px] font-bold">
          {person?.name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}

function ResearchCard({ post, onDelete, onVerify, onPin, isAdmin, currentUserId }) {
  const navigate = useNavigate()
  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const canAct = isAdmin || post.user_id === currentUserId
  const ctxItems = canAct ? [
    ...(isAdmin && !post.is_verified ? [{ label: 'Verify', icon: '✅', action: () => onVerify(post.id) }] : []),
    ...(isAdmin && !post.is_pinned   ? [{ label: 'Pin',    icon: '📌', action: () => onPin(post.id)    }] : []),
    ...(canAct ? [{ separator: true }, { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(post.id) }] : []),
  ] : null

  return (
    <div
      onContextMenu={ctxItems ? onContextMenu(ctxItems) : undefined}
      className={`relative bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer
        hover:shadow-md hover:-translate-y-0.5
        ${post.is_pinned
          ? 'border-emerald-200 dark:border-emerald-800/60'
          : post.is_verified
          ? 'border-blue-200 dark:border-blue-800/60'
          : 'border-gray-100 dark:border-gray-800'
        }`}
      onClick={() => navigate(`/research/${post.id}`)}
    >
      <ContextMenuPortal />
      {/* Status bar */}
      {post.is_pinned && (
        <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400" />
      )}
      {post.is_verified && !post.is_pinned && (
        <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400" />
      )}

      <div className="p-4">
        {/* Badge row */}
        <div className="flex items-center gap-1.5 mb-3">
          {post.is_pinned && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
              Distinguished
            </span>
          )}
          {post.is_verified && !post.is_pinned && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 tracking-wide uppercase">
              Verified
            </span>
          )}
          {post.is_admin_post && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 tracking-wide uppercase">
              Admin
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>

        {/* Excerpt */}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-3">
          {post.excerpt || 'Click to read the full research...'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Avatar person={post.author} />
            <div>
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-none">{post.author?.name || 'Unknown'}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
            </div>
          </div>


          {!isAdmin && post.user_id !== currentUserId && (
            <span className="text-[9px] text-blue-500 dark:text-blue-400 font-medium group-hover:underline">
              Read →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EligibilityBanner({ eligibility }) {
  const s = eligibility.stats
  const bars = [
    { label: 'Trades', val: s.totalTrades, max: 14, suffix: '/14' },
    { label: 'Profitable', val: s.profitableTrades || 0, max: 5, suffix: '/5' },
    { label: 'Win Rate', val: s.winRate || 0, max: 33, suffix: '%', target: 33 },
    { label: 'Avg R:R', val: s.avgRR || 0, max: 3, suffix: '', prefix: '1:', target: 3 },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Posting Eligibility Progress</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{eligibility.reason}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bars.map(({ label, val, max, suffix, prefix, target }) => {
          const pct = Math.min((val / max) * 100, 100)
          const met = val >= (target ?? max)
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
                <span className={`text-[11px] font-bold ${met ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}>
                  {prefix}{val}{suffix}
                </span>
              </div>
              <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${met ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [pendingPosts, setPendingPosts] = useState([])
  const [eligibility, setEligibility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('feed')

  const [fetchError, setFetchError] = useState(null)
  const [actionErr, setActionErr] = useState(null)
  const isAdmin = eligibility?.isAdmin === true

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null)
      const [postsRes, eligRes] = await Promise.allSettled([
        getResearchPosts(),
        getResearchEligibility()
      ])
      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data)
      else throw postsRes.reason
      if (eligRes.status === 'fulfilled') {
        const elig = eligRes.value.data
        setEligibility(elig)
        if (elig?.isAdmin) {
          const pendingRes = await getAdminPending()
          setPendingPosts(pendingRes.data)
        }
      }
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Failed to load research posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (postId) => {
    try {
      await deleteResearchPost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setPendingPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to delete post')
    }
  }

  const handleVerify = async (postId) => {
    try {
      await verifyResearchPost(postId)
      // Optimistic update — no full re-fetch needed
      const update = p => p.id === postId ? { ...p, is_verified: true } : p
      setPosts(prev => prev.map(update))
      setPendingPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to verify post')
    }
  }

  const handlePin = async (postId) => {
    try {
      await pinResearchPost(postId)
      // Optimistic update — toggle pin, no full re-fetch needed
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_pinned: !p.is_pinned } : p))
      setPendingPosts(prev => prev.map(p => p.id === postId ? { ...p, is_pinned: !p.is_pinned } : p))
    } catch (err) {
      setActionErr(err.response?.data?.error || 'Failed to pin post')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Members Only</h2>
          <p className="text-[11px] text-gray-400 mb-5">This research hub is only accessible to verified Tradeo members.</p>
          <Link to="/login" className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">
            Login to Access
          </Link>
        </div>
      </div>
    )
  }

  if (fetchError) return (
    <div className="w-full px-3 sm:px-6 py-10 max-w-6xl mx-auto text-center">
      <p className="text-[12px] text-red-400 mb-3">{fetchError}</p>
      <button
        onClick={() => { setFetchError(null); setLoading(true); fetchData() }}
        className="text-[11px] text-blue-500 hover:underline"
      >
        Retry
      </button>
    </div>
  )

  const pinnedPosts = posts.filter(p => p.is_pinned)
  const feedPosts = posts.filter(p => !p.is_pinned)

  const cardProps = { onDelete: handleDelete, onVerify: handleVerify, onPin: handlePin, isAdmin, currentUserId: user?.id }

  return (
    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-6xl mx-auto">

      {actionErr && (
        <div className="mb-4 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-red-500">{actionErr}</p>
          <button onClick={() => setActionErr(null)} className="text-red-400 hover:text-red-600 text-xs ml-3">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Research Hub</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Private trading research — members only</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setActiveTab(activeTab === 'pending' ? 'feed' : 'pending')}
              className={`text-[11px] px-3 py-1.5 rounded-xl font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
              }`}
            >
              Pending {pendingPosts.length > 0 && `(${pendingPosts.length})`}
            </button>
          )}
          {eligibility?.eligible ? (
            <button
              onClick={() => navigate('/research/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
            >
              + Post Research
            </button>
          ) : (
            <div className="text-right">
              <button disabled className="bg-gray-100 dark:bg-gray-800 text-gray-400 px-4 py-1.5 rounded-xl text-[11px] font-semibold cursor-not-allowed">
                + Post Research
              </button>
              <p className="text-[9px] text-gray-400 mt-1">Not yet eligible</p>
            </div>
          )}
        </div>
      </div>

      {/* Eligibility progress banner */}
      {!eligibility?.eligible && !eligibility?.isAdmin && eligibility?.stats && (
        <EligibilityBanner eligibility={eligibility} />
      )}

      {/* Pending tab (admin) */}
      {activeTab === 'pending' && isAdmin && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Pending Verification</p>
          {pendingPosts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-10 text-center">
              <p className="text-[12px] text-gray-400">No posts pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {pendingPosts.map(post => (
                <ResearchCard key={post.id} post={post} {...cardProps} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <div className="space-y-6">

          {/* Pinned / distinguished */}
          {pinnedPosts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Distinguished Research</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {pinnedPosts.map(post => (
                  <ResearchCard key={post.id} post={post} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* Research feed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Research Feed</p>
              <span className="text-[10px] text-gray-400">· {feedPosts.length} post{feedPosts.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/4 mb-3" />
                    <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6 mb-4" />
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-50 dark:border-gray-800">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800" />
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : feedPosts.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-14 text-center">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[12px] text-gray-400">No research posts yet</p>
                <p className="text-[10px] text-gray-400 mt-1">Be the first to share your analysis</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {feedPosts.map((post, i) => (
                  <div
                    key={post.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <ResearchCard post={post} {...cardProps} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ResearchPage
