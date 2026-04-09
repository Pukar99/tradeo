import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import {
  getResearchPosts,
  getResearchEligibility,
  deleteResearchPost,
  verifyResearchPost,
  pinResearchPost,
  getAdminPending
} from '../api'

const ADMIN_USER_ID = 1

function ResearchCard({ post, onDelete, onVerify, onPin, isAdmin, currentUserId }) {
  const navigate = useNavigate()

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${
      post.is_pinned
        ? 'border-green-200 dark:border-green-800'
        : post.is_verified
        ? 'border-blue-200 dark:border-blue-800'
        : 'border-gray-100 dark:border-gray-700'
    } overflow-hidden hover:shadow-md transition-shadow`}>

      {post.is_pinned && (
        <div className="bg-green-500 px-4 py-1 flex items-center gap-2">
          <span className="text-white text-xs font-semibold">📌 Distinguished Research by Admin</span>
        </div>
      )}
      {post.is_verified && !post.is_pinned && (
        <div className="bg-blue-500 px-4 py-1 flex items-center gap-2">
          <span className="text-white text-xs font-semibold">✓ Verified Research</span>
        </div>
      )}

      <div
        className="p-5 cursor-pointer"
        onClick={() => navigate(`/research/${post.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 hover:text-blue-600 transition-colors">
              {post.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {post.author?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {post.author?.name || 'Unknown'}
              </span>
              {post.is_verified && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  ✓ Verified
                </span>
              )}
              {post.is_admin_post && (
                <span className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  👑 Admin
                </span>
              )}
              <span className="text-xs text-gray-400">
                {formatDate(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
          {post.excerpt || 'Click to read the full research...'}
        </p>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between border-t border-gray-50 dark:border-gray-700 pt-3">
        <button
          onClick={() => navigate(`/research/${post.id}`)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Read Full Research →
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && !post.is_verified && (
            <button
              onClick={(e) => { e.stopPropagation(); onVerify(post.id) }}
              className="text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
            >
              ✓ Verify
            </button>
          )}
          {isAdmin && !post.is_pinned && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin(post.id) }}
              className="text-xs bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
            >
              📌 Pin
            </button>
          )}
          {(isAdmin || post.user_id === currentUserId) && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(post.id) }}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg"
            >
              Delete
            </button>
          )}
        </div>
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

  const isAdmin = user?.id === ADMIN_USER_ID

  const fetchData = async () => {
    try {
      const [postsRes, eligRes] = await Promise.all([
        getResearchPosts(),
        getResearchEligibility()
      ])
      setPosts(postsRes.data)
      setEligibility(eligRes.data)

      if (isAdmin) {
        const pendingRes = await getAdminPending()
        setPendingPosts(pendingRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this research post?')) return
    try {
      await deleteResearchPost(id)
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleVerify = async (id) => {
    try {
      await verifyResearchPost(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePin = async (id) => {
    try {
      await pinResearchPost(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center max-w-md">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Private Research Hub
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            This area is only accessible to verified Tradeo members.
          </p>
          <Link
            to="/login"
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            Login to Access
          </Link>
        </div>
      </div>
    )
  }

  const pinnedPosts = posts.filter(p => p.is_pinned)
  const feedPosts = posts.filter(p => !p.is_pinned)

  return (
    <div className="w-full px-6 py-6">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Research Hub
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Private trading research — members only
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setActiveTab(activeTab === 'pending' ? 'feed' : 'pending')}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 dark:bg-orange-900 text-orange-600 dark:text-orange-300'
              }`}
            >
              ⏳ Pending ({pendingPosts.length})
            </button>
          )}
          {eligibility?.eligible ? (
            <button
              onClick={() => navigate('/research/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Post Research
            </button>
          ) : (
            <div className="text-right">
              <button
                disabled
                className="bg-gray-200 dark:bg-gray-700 text-gray-400 px-4 py-2 rounded-xl text-sm font-semibold cursor-not-allowed"
              >
                + Post Research
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Not yet eligible
              </p>
            </div>
          )}
        </div>
      </div>

      {!eligibility?.eligible && !eligibility?.isAdmin && eligibility?.stats && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            📊 Your Eligibility Progress
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            {eligibility.reason}
          </p>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${
                eligibility.stats.totalTrades >= 14 ? 'text-green-500' : 'text-red-400'
              }`}>
                {eligibility.stats.totalTrades}/14
              </p>
              <p className="text-xs text-gray-400">Total Trades</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${
                eligibility.stats.profitableTrades >= 5 ? 'text-green-500' : 'text-red-400'
              }`}>
                {eligibility.stats.profitableTrades || 0}/5
              </p>
              <p className="text-xs text-gray-400">Profit Trades</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${
                (eligibility.stats.winRate || 0) >= 33 ? 'text-green-500' : 'text-red-400'
              }`}>
                {eligibility.stats.winRate || 0}%
              </p>
              <p className="text-xs text-gray-400">Win Rate</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${
                (eligibility.stats.avgRR || 0) >= 3 ? 'text-green-500' : 'text-red-400'
              }`}>
                1:{eligibility.stats.avgRR || 0}
              </p>
              <p className="text-xs text-gray-400">Avg RR</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pending' && isAdmin && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            ⏳ Pending Verification
          </h2>
          {pendingPosts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">No posts pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingPosts.map(post => (
                <ResearchCard
                  key={post.id}
                  post={post}
                  onDelete={handleDelete}
                  onVerify={handleVerify}
                  onPin={handlePin}
                  isAdmin={isAdmin}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'feed' && (
        <>
          {pinnedPosts.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-500">📌</span>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Distinguished Research
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pinnedPosts.map(post => (
                  <ResearchCard
                    key={post.id}
                    post={post}
                    onDelete={handleDelete}
                    onVerify={handleVerify}
                    onPin={handlePin}
                    isAdmin={isAdmin}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-500">📚</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Research Feed
              </h2>
              <span className="text-xs text-gray-400">
                {feedPosts.length} post{feedPosts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm animate-pulse">
                    <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-3/4 mb-3" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mb-4" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full mb-2" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-5/6" />
                  </div>
                ))}
              </div>
            ) : feedPosts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
                <span className="text-4xl mb-4 block">📭</span>
                <p className="text-gray-400 text-sm">No research posts yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Be the first to share your research with the community
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {feedPosts.map(post => (
                  <ResearchCard
                    key={post.id}
                    post={post}
                    onDelete={handleDelete}
                    onVerify={handleVerify}
                    onPin={handlePin}
                    isAdmin={isAdmin}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ResearchPage