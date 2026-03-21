import { useToastStore } from '../../stores/toastStore'

const colorMap = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
} as const

export default function Toast() {
  const { toasts, removeToast } = useToastStore()

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${colorMap[t.type]} text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-auto animate-fade-in cursor-pointer max-w-[90vw]`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
