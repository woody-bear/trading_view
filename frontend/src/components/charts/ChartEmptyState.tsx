interface Props {
  status: 'empty' | 'timeout' | 'error'
  message?: string
  onRetry?: () => void
}

const defaults: Record<Props['status'], string> = {
  empty: '차트 데이터가 없습니다',
  timeout: '데이터 로딩 시간이 초과되었습니다',
  error: '차트 데이터를 불러올 수 없습니다',
}

export default function ChartEmptyState({ status, message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-[670px] bg-[#1e293b] rounded-lg border border-[var(--border)]">
      <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="text-gray-400 text-sm mb-3">{message || defaults[status]}</p>
      {(status === 'timeout' || status === 'error') && onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          재시도
        </button>
      )}
    </div>
  )
}
