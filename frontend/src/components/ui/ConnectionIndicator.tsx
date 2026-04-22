export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

interface Props {
  status: ConnectionStatus
  onReconnect: () => void
}

export default function ConnectionIndicator({ status }: Props) {
  if (status !== 'connected') return null

  return (
    <span className="text-caption md:text-micro text-green-600 flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      실시간
    </span>
  )
}
