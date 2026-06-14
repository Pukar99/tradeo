// =============================================================================
// ErrorBoundary.jsx — Generic React error boundary
// =============================================================================
// Props: label (string) — shown in fallback UI; onReset (fn) — called on "Try Again"
// =============================================================================

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // In production you would send to Sentry / logging service here
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info?.componentStack)
  }

  handleReset() {
    this.setState({ error: null, info: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    const { label = 'This section', children } = this.props

    if (!error) return children

    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 p-8">
        <div className="max-w-sm w-full text-center">
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>

          <h2 className="text-[14px] font-bold text-gray-800 dark:text-gray-100 mb-1">
            {label} crashed
          </h2>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4 leading-relaxed">
            Something went wrong rendering this section. Your data is safe.
          </p>

          <details className="text-left mb-4 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <summary className="px-3 py-2 text-[10px] font-semibold text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 select-none">
              Error details
            </summary>
            <pre className="px-3 py-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/10 overflow-x-auto whitespace-pre-wrap break-all">
              {error.toString()}
            </pre>
          </details>

          <button
            onClick={this.handleReset}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }
}
