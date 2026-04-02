import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  authError: string | null
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setAuthError: (error: string | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      loading: true,
      authError: null,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session, user: session?.user ?? null }),
      setLoading: (loading) => set({ loading }),
      setAuthError: (authError) => set({ authError }),
      clear: () => set({ user: null, session: null, loading: false, authError: null }),
    }),
    {
      name: 'auth-storage',
      // session(JWT)은 만료 토큰 잔류 문제로 persist 제외 — Supabase가 자체 관리
      partialize: (state) => ({ user: state.user }),
    }
  )
)
