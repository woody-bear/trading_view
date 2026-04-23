import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // getSession()과 onAuthStateChange를 동시에 호출하면 Supabase 내부 락 경합 발생 (5초 블락).
    // onAuthStateChange만 사용 — INITIAL_SESSION 이벤트로 초기 세션을 즉시 받아 락 충돌 없음.
    const timeout = setTimeout(() => setLoading(false), 5000) // 미응답 안전망

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        clearTimeout(timeout)
        setSession(session)
        // syncUser보다 먼저 loading 해제 — apiClient 인터셉터가 authStore.session을 읽을 수 있어야 함
        setLoading(false)
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          await syncUser(session.access_token)
        }
      }
    )

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  return <>{children}</>
}

async function syncUser(accessToken: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser(accessToken)
    if (!user) return
    await apiClient.post(
      '/api/auth/sync',
      {
        email: user.email ?? '',
        display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
  } catch {
    // sync 실패는 로그인 자체를 막지 않음
  }
}
