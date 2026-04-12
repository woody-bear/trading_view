export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

interface Props {
  status: ConnectionStatus
  onReconnect: () => void
}

const config = {
  connected: { color: 'text-green-400', bg: 'bg-green-400', text: '실시간' },
  reconnecting: { color: 'text-yellow-400', bg: 'bg-yellow-400', text: '재연결 중...' },
  disconnected: { color: 'text-red-400', bg: 'bg-red-400', text: '연결 끊김' },
} as const

export default function ConnectionIndicator({ status, onReconnect }: Props) {
  const c = config[status]
  return (
    <span className={`text-caption md:text-micro ${c.color} flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 ${c.bg} rounded-full ${status === 'connected' ? 'animate-pulse' : ''}`} />
      {c.text}
      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          className="ml-1 px-1.5 py-0.5 text-micro bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          재연결
        </button>
      )}
    </span>
  )
}
