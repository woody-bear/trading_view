import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) syncUser(session.access_token)
      setLoading(false)
    })

    // 세션 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (event === 'SIGNED_IN' && session) {
          await syncUser(session.access_token)
        } else if (event === 'SIGNED_OUT') {
          setLoading(false)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
