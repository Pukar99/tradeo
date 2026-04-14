import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, uploadAvatar, changePassword } from '../api'

const ADMIN_USER_ID = 1
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

function StatCard({ label, value, color = 'text-gray-900 dark:text-white', sub }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ProfilePage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [editing, setEditing] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [form, setForm] = useState({
    name: '',
    bio: '',
    location: '',
    trading_since: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Auth redirect — use useEffect, never navigate during render
  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  const fetchProfile = useCallback(async () => {
    setFetchError('')
    try {
      const res = await getProfile()
      setProfile(res.data)
      setForm({
        name: res.data.user.name || '',
        bio: res.data.user.bio || '',
        location: res.data.user.location || '',
        trading_since: res.data.user.trading_since || ''
      })
    } catch (err) {
      console.error('fetchProfile error:', err)
      setFetchError(err.response?.data?.message || 'Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchProfile()
  }, [user, fetchProfile])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Client-side validation before hitting the network
    setAvatarError('')
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Only JPG, PNG, GIF or WebP images are allowed.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Image must be under 5 MB.')
      e.target.value = ''
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await uploadAvatar(formData)
      setProfile(prev => ({
        ...prev,
        user: { ...prev.user, avatar_url: res.data.avatar_url }
      }))
      updateUser({ avatar_url: res.data.avatar_url })
    } catch (err) {
      console.error('Avatar upload error:', err)
      setAvatarError(err.response?.data?.message || 'Failed to upload avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
      // Reset input so the same file can be re-selected after an error
      e.target.value = ''
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (form.name.trim().length > 100) errors.name = 'Name must be under 100 characters'
    if (form.bio.length > 500) errors.bio = 'Bio must be under 500 characters'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await updateProfile(form)
      setProfile(prev => ({ ...prev, user: { ...prev.user, ...res.data } }))
      updateUser({ name: form.name.trim() })
      setEditing(false)
      setFormErrors({})
    } catch (err) {
      console.error('handleSave error:', err)
      setSaveError(err.response?.data?.message || 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset form to current saved values
    if (profile) {
      setForm({
        name: profile.user.name || '',
        bio: profile.user.bio || '',
        location: profile.user.location || '',
        trading_since: profile.user.trading_since || ''
      })
    }
    setEditing(false)
    setFormErrors({})
    setSaveError('')
    setShowPasswordForm(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    setSavingPassword(true)
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      setPasswordSuccess('Password changed successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        setShowPasswordForm(false)
        setPasswordSuccess('')
      }, 2000)
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    // Use ISO string to avoid UTC vs local timezone off-by-one
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  }

  const getTraderLevel = () => {
    const trades = profile?.stats?.totalTrades || 0
    if (trades === 0) return { label: 'Beginner', color: 'text-gray-400', icon: '🌱' }
    if (trades < 10) return { label: 'Novice', color: 'text-blue-400', icon: '📘' }
    if (trades < 25) return { label: 'Intermediate', color: 'text-green-400', icon: '📈' }
    if (trades < 50) return { label: 'Advanced', color: 'text-purple-400', icon: '🔥' }
    return { label: 'Expert', color: 'text-yellow-400', icon: '👑' }
  }

  if (loading) return (
    <div className="w-full px-6 py-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading profile...</p>
      </div>
    </div>
  )

  if (fetchError) return (
    <div className="w-full px-6 py-6 flex flex-col items-center justify-center min-h-64 gap-4">
      <p className="text-red-400 text-sm">{fetchError}</p>
      <button
        onClick={() => { setLoading(true); fetchProfile() }}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Retry
      </button>
    </div>
  )

  if (!profile) return null

  const level = getTraderLevel()
  const isAdmin = profile.user.id === ADMIN_USER_ID

  return (
    <div className="w-full px-6 pt-6 pb-10 max-w-5xl mx-auto">

      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 rounded-2xl overflow-hidden mb-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500 rounded-full filter blur-3xl" />
        </div>

        <div className="relative p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white border-opacity-20 shadow-xl">
                  {profile.user.avatar_url ? (
                    <img
                      src={profile.user.avatar_url}
                      alt={profile.user.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-3xl font-bold">{getInitials(profile.user.name)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change avatar"
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg flex items-center justify-center shadow-lg transition-colors"
                >
                  {uploadingAvatar ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold text-white">{profile.user.name}</h1>
                  {isAdmin && (
                    <span className="bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                      👑 Admin
                    </span>
                  )}
                  {profile.isEligible && (
                    <span className="bg-green-500 bg-opacity-20 text-green-400 border border-green-500 border-opacity-30 text-xs font-medium px-2 py-0.5 rounded-full">
                      ✓ Research Eligible
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-2">{profile.user.email}</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className={`text-sm font-medium ${level.color}`}>{level.icon} {level.label} Trader</span>
                  {profile.user.location && <span className="text-gray-400 text-xs">📍 {profile.user.location}</span>}
                  {profile.user.trading_since && <span className="text-gray-400 text-xs">📅 Trading since {profile.user.trading_since}</span>}
                  <span className="text-gray-500 text-xs">Member since {formatDate(profile.user.created_at)}</span>
                </div>
                {profile.user.bio && <p className="text-gray-300 text-sm mt-2 max-w-md">{profile.user.bio}</p>}
                {/* Avatar error shown near the avatar area */}
                {avatarError && (
                  <p className="text-red-400 text-xs mt-1">{avatarError}
                    <button onClick={() => setAvatarError('')} className="ml-2 underline">Dismiss</button>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => editing ? handleCancelEdit() : setEditing(true)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                editing
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-white bg-opacity-10 text-white hover:bg-opacity-20 border border-white border-opacity-20'
              }`}
            >
              {editing ? 'Cancel' : '✏️ Edit Profile'}
            </button>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white bg-opacity-5 rounded-xl p-3 text-center border border-white border-opacity-10">
              <p className="text-2xl font-bold text-white">{profile.stats.totalTrades}</p>
              <p className="text-xs text-gray-400 mt-1">Total Trades</p>
            </div>
            <div className="bg-white bg-opacity-5 rounded-xl p-3 text-center border border-white border-opacity-10">
              <p className={`text-2xl font-bold ${profile.stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {profile.stats.winRate}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Win Rate</p>
            </div>
            <div className="bg-white bg-opacity-5 rounded-xl p-3 text-center border border-white border-opacity-10">
              <p className="text-2xl font-bold text-blue-400">🔥 {profile.discipline.streak}</p>
              <p className="text-xs text-gray-400 mt-1">Day Streak</p>
            </div>
            <div className="bg-white bg-opacity-5 rounded-xl p-3 text-center border border-white border-opacity-10">
              <p className="text-2xl font-bold text-purple-400">{profile.research.totalPosts}</p>
              <p className="text-xs text-gray-400 mt-1">Research Posts</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Panel ── */}
      {editing && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Edit Profile</h2>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm mb-4 flex items-center justify-between">
              <span>{saveError}</span>
              <button onClick={() => setSaveError('')} className="text-red-400 hover:text-red-600 ml-2">✕</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(p => ({ ...p, name: '' })) }}
                maxLength={100}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none dark:bg-gray-700 dark:text-white ${
                  formErrors.name
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-gray-200 dark:border-gray-600 focus:border-blue-500'
                }`}
              />
              {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Kathmandu, Nepal"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Trading Since</label>
              <input
                type="text"
                value={form.trading_since}
                onChange={e => setForm({ ...form, trading_since: e.target.value })}
                placeholder="e.g. 2020"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center justify-between">
                <span>Bio</span>
                <span className={`text-xs ${form.bio.length > 450 ? 'text-red-400' : 'text-gray-400'}`}>
                  {form.bio.length}/500
                </span>
              </label>
              {/* textarea for multi-line bio — input was wrong here */}
              <textarea
                value={form.bio}
                onChange={e => { setForm({ ...form, bio: e.target.value }); setFormErrors(p => ({ ...p, bio: '' })) }}
                placeholder="Short bio about your trading style"
                rows={3}
                maxLength={500}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none dark:bg-gray-700 dark:text-white ${
                  formErrors.bio
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-gray-200 dark:border-gray-600 focus:border-blue-500'
                }`}
              />
              {formErrors.bio && <p className="text-red-400 text-xs mt-1">{formErrors.bio}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-6 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {showPasswordForm ? 'Cancel Password Change' : '🔒 Change Password'}
            </button>
          </div>

          {showPasswordForm && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Change Password</h3>
              {passwordError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-3 py-2 rounded-xl text-sm mb-3 flex items-center justify-between">
                  <span>{passwordError}</span>
                  <button onClick={() => setPasswordError('')} className="ml-2 text-red-400 hover:text-red-600">✕</button>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-3 py-2 rounded-xl text-sm mb-3">
                  ✓ {passwordSuccess}
                </div>
              )}
              <form onSubmit={handleChangePassword} autoComplete="off">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="bg-red-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {savingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6">
        {['overview', 'trading', 'discipline', 'research'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab === 'overview' && '📊 '}
            {tab === 'trading' && '📈 '}
            {tab === 'discipline' && '🎯 '}
            {tab === 'research' && '📚 '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📈</span> Trading Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Trades</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.stats.totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Closed Trades</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.stats.closedTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Win Rate</span>
                <span className={`text-sm font-bold ${profile.stats.winRate >= 50 ? 'text-green-500' : 'text-red-400'}`}>
                  {profile.stats.winRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Avg RR</span>
                <span className="text-sm font-bold text-blue-500">1:{profile.stats.avgRR}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Realized P&L</span>
                <span className={`text-sm font-bold ${profile.stats.totalRealizedPnl >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {profile.stats.totalRealizedPnl >= 0 ? '+' : ''}Rs.{Math.abs(profile.stats.totalRealizedPnl).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Open Positions</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.stats.openPositions}</span>
              </div>
              {profile.stats.bestTrade && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Best Trade</span>
                  <span className="text-sm font-bold text-green-500">
                    {profile.stats.bestTrade.symbol} +Rs.{profile.stats.bestTrade.pnl.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🎯</span> Discipline
            </h3>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="30" fill="none"
                    stroke={profile.discipline.monthlyScore >= 80 ? '#22c55e' : profile.discipline.monthlyScore >= 50 ? '#3b82f6' : '#f87171'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * (1 - profile.discipline.monthlyScore / 100)}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{profile.discipline.monthlyScore}%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Current Streak</span>
                <span className="text-sm font-bold text-orange-400">🔥 {profile.discipline.streak} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Days Tracked</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.discipline.totalDaysTracked}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📚</span> Research
            </h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Posts Published</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.research.totalPosts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Verified Posts</span>
                <span className="text-sm font-bold text-blue-500">{profile.research.verifiedPosts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Eligibility</span>
                <span className={`text-sm font-bold ${profile.isEligible ? 'text-green-500' : 'text-red-400'}`}>
                  {profile.isEligible ? '✓ Eligible' : '✗ Not Yet'}
                </span>
              </div>
            </div>
            {profile.research.recentPosts.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Recent Posts</p>
                {profile.research.recentPosts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => navigate(`/research/${post.id}`)}
                    className="text-xs text-gray-600 dark:text-gray-300 py-1 border-b border-gray-50 dark:border-gray-700 truncate cursor-pointer hover:text-blue-500 transition-colors"
                  >
                    {post.is_verified && <span className="text-blue-500 mr-1">✓</span>}
                    {post.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Trading Tab ── */}
      {activeTab === 'trading' && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Trades" value={profile.stats.totalTrades} />
          <StatCard label="Closed Trades" value={profile.stats.closedTrades} color="text-blue-400" />
          <StatCard label="Open Positions" value={profile.stats.openPositions} color="text-green-400" />
          <StatCard label="Win Rate" value={`${profile.stats.winRate}%`} color={profile.stats.winRate >= 50 ? 'text-green-500' : 'text-red-400'} />
          <StatCard label="Avg Risk/Reward" value={`1:${profile.stats.avgRR}`} color="text-blue-500" />
          <StatCard label="Profitable Trades" value={profile.stats.profitableTrades} color="text-green-500" />
          <StatCard
            label="Realized P&L"
            value={`${profile.stats.totalRealizedPnl >= 0 ? '+' : ''}Rs.${Math.abs(profile.stats.totalRealizedPnl).toLocaleString()}`}
            color={profile.stats.totalRealizedPnl >= 0 ? 'text-green-500' : 'text-red-400'}
          />
          <StatCard
            label="Capital at Risk"
            value={profile.stats.totalInvested > 0 ? `Rs.${Math.round(profile.stats.totalInvested / 1000)}K` : '—'}
            color="text-purple-400"
          />
          <div className={`col-span-4 rounded-xl p-4 text-center ${
            profile.isEligible
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
              : 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700'
          }`}>
            <p className={`text-sm font-semibold ${profile.isEligible ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {profile.isEligible
                ? '🎉 You are eligible to post research! Your trading metrics meet all requirements.'
                : `⏳ Keep trading! You need 14+ trades (${profile.stats.totalTrades}/14), 5+ profitable (${profile.stats.profitableTrades}/5), 33%+ win rate (${profile.stats.winRate}%), and 1:3+ avg RR (1:${profile.stats.avgRR}).`
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Discipline Tab ── */}
      {activeTab === 'discipline' && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Today's Score" value={`${profile.discipline.todayScore}%`} color={profile.discipline.todayScore >= 80 ? 'text-green-500' : profile.discipline.todayScore >= 50 ? 'text-blue-500' : 'text-red-400'} />
          <StatCard label="Monthly Average" value={`${profile.discipline.monthlyScore}%`} color="text-blue-500" />
          <StatCard label="Current Streak" value={`🔥 ${profile.discipline.streak}`} color="text-orange-400" sub="consecutive days ≥70%" />
          <StatCard label="Total Days Tracked" value={profile.discipline.totalDaysTracked} />
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Discipline Impact</h3>
            <p className={`text-sm font-medium p-3 rounded-lg ${
              profile.discipline.todayScore >= 80
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : profile.discipline.todayScore <= 40
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
            }`}>
              {profile.discipline.todayScore >= 80
                ? '💎 Strong discipline — you are aligned.'
                : profile.discipline.todayScore <= 40
                ? '⚠️ Low discipline day — trade smaller position.'
                : '📈 Good progress — stay focused.'
              }
            </p>
            {profile.discipline.totalDaysTracked === 0 && (
              <p className="text-xs text-gray-400 mt-3">Complete your daily tasks on the Home page to start tracking discipline.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Research Tab ── */}
      {activeTab === 'research' && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Posts Published" value={profile.research.totalPosts} color="text-blue-500" />
          <StatCard label="Verified Posts" value={profile.research.verifiedPosts} color="text-green-500" />
          <StatCard label="Research Status" value={profile.isEligible ? '✓ Eligible' : '✗ Not Yet'} color={profile.isEligible ? 'text-green-500' : 'text-red-400'} />
          {profile.research.recentPosts.length > 0 ? (
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Research Posts</h3>
              <div className="space-y-2">
                {profile.research.recentPosts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => navigate(`/research/${post.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {post.is_verified && <span className="text-blue-500 text-xs">✓</span>}
                      <span className="text-sm text-gray-700 dark:text-gray-300">{post.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(post.created_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-gray-400 text-sm">No published research posts yet.</p>
              {profile.isEligible && (
                <button
                  onClick={() => navigate('/research/new')}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Write Your First Post
                </button>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default ProfilePage
