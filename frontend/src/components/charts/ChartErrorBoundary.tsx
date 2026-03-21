import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
}

export default class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChartErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center h-[670px] bg-[#1e293b] rounded-lg border border-[var(--border)]">
          <svg className="w-12 h-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-gray-400 text-sm mb-3">차트를 표시할 수 없습니다. 새로고침해 주세요.</p>
          <button
            onClick={this.handleReset}
            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            새로고침
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
