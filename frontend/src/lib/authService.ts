import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'

type AuthEventType = 'SIGNED_OUT' | 'SILENT_FAILURE' | 'TOKEN_REFRESHED' | 'AUTO_RECOVERED'

type LogoutReason =
  | 'user_requested'
  | 'token_refresh_failed'
  | 'token_invalid'
  | 'network_error'
  | 'session_expired'

interface AuthEvent {
  type: AuthEventType
  reason?: LogoutReason
  source: string
  url?: string
  recovered?: boolean
  ts: string
}

// 중복 로그아웃 방지 잠금 — 컴포넌트 생명주기와 무관하게 앱 전체 단일 인스턴스 보장
let _signingOut = false

export function logAuthEvent(event: AuthEvent): void {
  const parts = [`[AUTH] ${event.type}`]
  if (event.reason) parts.push(`reason=${event.reason}`)
  parts.push(`source=${event.source}`)
  if (event.url) parts.push(`url=${event.url}`)
  if (event.type === 'SILENT_FAILURE' && event.recovered !== undefined) {
    parts.push(`recovered=${event.recovered}`)
  }
  parts.push(`ts=${event.ts}`)
  console.warn(parts.join(' | '))
}

export async function signOutWithReason(
  reason: LogoutReason,
  source: string,
  url?: string
): Promise<void> {
  if (_signingOut) return
  _signingOut = true
  try {
    logAuthEvent({ type: 'SIGNED_OUT', reason, source, url, ts: new Date().toISOString() })
    // 비자발적 로그아웃 시 현재 페이지를 저장해 재로그인 후 복귀 (T007에서 활성화됨)
    if (reason !== 'user_requested') {
      const path = window.location.pathname
      if (!path.includes('/auth') && !path.includes('/login')) {
        localStorage.setItem('auth_return_url', window.location.href)
      }
    }
    await supabase.auth.signOut()
    useAuthStore.getState().clear()
  } finally {
    _signingOut = false
  }
}
