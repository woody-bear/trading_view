import { supabase } from '../lib/supabase'

interface Props {
  message?: string
  onClose: () => void
}

export function LoginPromptModal({ message = '이 기능을 사용하려면 로그인이 필요합니다.', onClose }: Props) {
  const handleLogin = async () => {
    onClose()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 w-80 mx-4">
        <h3 className="text-white font-semibold mb-2">로그인이 필요합니다</h3>
        <p className="text-sm text-[var(--muted)] mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={handleLogin}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          >
            Google 로그인
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm rounded-lg hover:text-white transition"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
