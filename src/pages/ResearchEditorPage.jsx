import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  createResearchPost,
  updateResearchPost,
  getResearchPost,
  uploadResearchFile
} from '../api'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

function ResearchEditorPage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id
  const fileInputRef = useRef(null)

  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState('editor')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEditing)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const editor = useCreateBlockNote({
    uploadFile: async (file) => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadResearchFile(formData)
        return res.data.url
      } catch (err) {
        console.error('Image upload failed:', err)
        // Return undefined so BlockNote does not insert a broken image
        return undefined
      }
    }
  })

  useEffect(() => {
    if (isEditing) {
      getResearchPost(id)
        .then(async res => {
          const post = res.data
          setTitle(post.title)
          setStatus(post.status)
          setPostType(post.post_type || 'editor')
          if (post.pdf_url) {
            setPdfUrl(post.pdf_url)
            setPdfName(post.pdf_name || 'Uploaded PDF')
          }
          if (post.content && post.post_type !== 'pdf' && editor) {
            try {
              await editor.replaceBlocks(editor.document, post.content)
            } catch (err) {
              console.error('Editor load error:', err)
              setError('Failed to load post content into editor')
            }
          }
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Failed to load post for editing')
        })
        .finally(() => setLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handlePdfDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      await uploadPdf(file)
    } else {
      setError('Please drop a PDF file only')
    }
  }

  const handlePdfSelect = async (e) => {
    const file = e.target.files[0]
    if (file) await uploadPdf(file)
  }

  const uploadPdf = async (file) => {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadResearchFile(formData)
      setPdfUrl(res.data.url)
      setPdfName(file.name)
    } catch (err) {
      setError('Failed to upload PDF. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const getExcerpt = () => {
    try {
      const blocks = editor?.document
      if (!blocks) return ''
      let text = ''
      for (const block of blocks) {
        if (block.content) {
          for (const item of block.content) {
            if (item.text) text += item.text + ' '
          }
        }
        if (text.length > 200) break
      }
      return text.trim().substring(0, 200)
    } catch {
      return ''
    }
  }

  const handleSave = async (saveStatus) => {
    if (!title.trim()) {
      setError('Please add a title')
      return
    }
    if (postType === 'pdf' && !pdfUrl) {
      setError('Please upload a PDF file')
      return
    }

    setSaving(true)
    setError('')

    try {
      const content = postType === 'editor' ? (editor?.document ?? null) : null
      const payload = {
        title,
        status: saveStatus || status,
        post_type: postType,
        excerpt: postType === 'pdf'
          ? `PDF Research: ${pdfName}`
          : getExcerpt(),
        content,
        pdf_url: postType === 'pdf' ? pdfUrl : null,
        pdf_name: postType === 'pdf' ? pdfName : null,
      }

      if (isEditing) {
        await updateResearchPost(id, payload)
      } else {
        await createResearchPost(payload)
      }
      navigate('/research')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Check eligibility.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  if (!user) return null

  if (loading) return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-4xl mx-auto">
      <p className="text-gray-400 text-sm">Loading editor...</p>
    </div>
  )

  return (
    <div className="w-full px-3 sm:px-6 py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          onClick={() => navigate('/research')}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Research Hub
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || uploading}
            className="text-[11px] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving || uploading}
            className="text-[11px] px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/30 px-4 py-2.5 rounded-xl mb-4 border border-red-100 dark:border-red-800/50">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">

        <div className="px-3 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Research Title..."
            className="w-full text-xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-600"
          />
        </div>

        <div className="px-3 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Format</p>
          <div className="flex gap-1.5">
            {[{ val: 'editor', label: 'Editor' }, { val: 'pdf', label: 'PDF Upload' }].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setPostType(val)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  postType === val
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

{postType === 'editor' && (
  <div className="min-h-96 dark:bg-gray-900 rounded-b-xl overflow-hidden">
            <BlockNoteView
              editor={editor}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>
        )}

        {postType === 'pdf' && (
          <div className="p-6">
            {!pdfUrl ? (
              <div
                onDrop={handlePdfDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfSelect}
                  className="hidden"
                />
                {uploading ? (
                  <div>
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Uploading PDF...
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-4xl mb-4 block">📄</span>
                    <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Drop your PDF here
                    </p>
                    <p className="text-sm text-gray-400">
                      or click to browse — max 10MB
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                    <span className="text-red-500 text-lg">📄</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pdfName}
                    </p>
                    <p className="text-xs text-green-500">
                      ✓ Uploaded successfully
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Preview
                  </a>
                  <button
                    onClick={() => { setPdfUrl(''); setPdfName('') }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400">
          {postType === 'editor'
            ? <>Type <kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[9px]">/</kbd> for headings, tables, code blocks · paste images directly</>
            : 'Upload a pre-made PDF research document'}
        </p>
        <span className={`text-[10px] font-medium ${status === 'published' ? 'text-emerald-500' : 'text-amber-400'}`}>
          {status === 'published' ? 'Published' : 'Draft'}
        </span>
      </div>

    </div>
  )
}

export default ResearchEditorPage