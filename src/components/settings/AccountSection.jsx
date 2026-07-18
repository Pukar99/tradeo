// === AccountSection.jsx — avatar upload + profile fields (moved from ProfilePage, Wave 3) ===
// Renders inside the "account" SettingsSection (SettingsPage.jsx). Loads current values via the
// shared cached getProfile() (same cache entry ProfilePage's hero/display reads — a Profile visit
// first means this mounts with 0 new requests). Save/upload wiring replicated EXACTLY from
// ProfilePage.jsx's handleAvatarUpload (:86-121) and handleSave (:132-148): API call →
// clearProfileCache() → updateUser({...}) from AuthContext — that last call is what live-updates
// the navbar name/avatar without a re-login. Field semantics/max-lengths/copy match today's Edit
// Panel verbatim. a11y: every input has a real <label htmlFor>, unique ids prefixed `account-`,
// 44px targets, dark: pairs, focus rings.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile, uploadAvatar } from '../../api'
import { getProfile, clearProfileCache } from '../../utils/globalCache'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

const LABEL_CLS = 'block text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5'
const INPUT_CLS =
  'w-full min-h-[44px] border rounded-xl px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-gray-800 dark:text-white'
const INPUT_BORDER = 'border-gray-200 dark:border-gray-700 focus:border-blue-500'
const INPUT_BORDER_ERROR = 'border-red-400 focus:border-red-400'

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function AccountSection() {
  const { updateUser } = useAuth()
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarImgError, setAvatarImgError] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [form, setForm] = useState({ name: '', bio: '', location: '', trading_since: '' })
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const res = await getProfile()
      setAvatarUrl(res.data.user.avatar_url || '')
      setDisplayName(res.data.user.name || '')
      setForm({
        name: res.data.user.name || '',
        bio: res.data.user.bio || '',
        location: res.data.user.location || '',
        trading_since: res.data.user.trading_since || '',
      })
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Client-side validation before hitting the network — same rule/copy as ProfilePage
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
      clearProfileCache()
      setAvatarUrl(res.data.avatar_url)
      setAvatarImgError(false)
      updateUser({ avatar_url: res.data.avatar_url })
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to upload avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
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
    setSaveSuccess('')
    try {
      await updateProfile(form)
      clearProfileCache()
      setDisplayName(form.name.trim())
      updateUser({ name: form.name.trim() })
      setFormErrors({})
      setSaveSuccess('Profile saved.')
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-red-400 text-sm">{fetchError}</p>
        <button
          type="button"
          onClick={fetchProfile}
          className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shrink-0">
          {avatarUrl && !avatarImgError && /^https?:\/\//.test(avatarUrl) ? (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onError is a load-lifecycle fallback, not a user interaction; same pattern as ProfilePage.jsx
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={() => setAvatarImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{getInitials(displayName)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {uploadingAvatar ? 'Uploading...' : 'Upload avatar'}
          </button>
          <input
            ref={fileInputRef}
            id="account-avatar-input"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
            aria-label="Upload avatar image"
          />
          {avatarError && (
            <p className="text-red-400 text-xs">
              {avatarError}
              <button
                type="button"
                onClick={() => setAvatarError('')}
                className="ml-2 underline"
              >
                Dismiss
              </button>
            </p>
          )}
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError('')}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-4 py-3 rounded-xl text-sm">
          ✓ {saveSuccess}
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="account-name" className={LABEL_CLS}>
            <span>
              Full Name <span className="text-red-400">*</span>
            </span>
            <input
              id="account-name"
              type="text"
              aria-label="Full Name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                setFormErrors((p) => ({ ...p, name: '' }))
              }}
              maxLength={100}
              className={`${INPUT_CLS} ${formErrors.name ? INPUT_BORDER_ERROR : INPUT_BORDER}`}
            />
          </label>
          {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="account-location" className={LABEL_CLS}>
            <span>Location</span>
            <input
              id="account-location"
              type="text"
              aria-label="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Kathmandu, Nepal"
              className={`${INPUT_CLS} ${INPUT_BORDER}`}
            />
          </label>
        </div>
        <div>
          <label htmlFor="account-trading-since" className={LABEL_CLS}>
            <span>Trading Since</span>
            <input
              id="account-trading-since"
              type="text"
              aria-label="Trading Since"
              value={form.trading_since}
              onChange={(e) => setForm({ ...form, trading_since: e.target.value })}
              placeholder="e.g. 2020"
              className={`${INPUT_CLS} ${INPUT_BORDER}`}
            />
          </label>
        </div>
        <div>
          <label htmlFor="account-bio" className={LABEL_CLS}>
            <span className="flex items-center justify-between">
              <span>Bio</span>
              <span
                className={`text-xs font-normal normal-case tracking-normal ${form.bio.length > 450 ? 'text-red-400' : 'text-gray-400'}`}
              >
                {form.bio.length}/500
              </span>
            </span>
            <textarea
              id="account-bio"
              aria-label="Bio"
              value={form.bio}
              onChange={(e) => {
                setForm({ ...form, bio: e.target.value })
                setFormErrors((p) => ({ ...p, bio: '' }))
              }}
              placeholder="Short bio about your trading style"
              rows={3}
              maxLength={500}
              className={`${INPUT_CLS} resize-none ${formErrors.bio ? INPUT_BORDER_ERROR : INPUT_BORDER}`}
            />
          </label>
          {formErrors.bio && <p className="text-red-400 text-xs mt-1">{formErrors.bio}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="min-h-[44px] px-6 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
