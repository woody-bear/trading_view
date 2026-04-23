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

const _AUTH_LOG_KEY = '__auth_log'
const _AUTH_LOG_MAX = 30

function _persistLog(msg: string): void {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(_AUTH_LOG_KEY) ?? '[]')
    stored.push(msg)
    if (stored.length > _AUTH_LOG_MAX) stored.splice(0, stored.length - _AUTH_LOG_MAX)
    localStorage.setItem(_AUTH_LOG_KEY, JSON.stringify(stored))
  } catch { /* storage quota 등 무시 */ }
}

// DevTools 콘솔에서 showAuthLog() 로 최근 인증 이벤트 조회 (새로고침 후에도 유지)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  w.showAuthLog = () => {
    const logs: string[] = JSON.parse(localStorage.getItem(_AUTH_LOG_KEY) ?? '[]')
    if (logs.length === 0) { console.log('[AUTH] 저장된 로그 없음'); return [] }
    logs.forEach(l => console.log(l))
    return logs
  }
  w.clearAuthLog = () => {
    localStorage.removeItem(_AUTH_LOG_KEY)
    console.log('[AUTH] 로그 초기화 완료')
  }
}

export function logAuthEvent(event: AuthEvent): void {
  const parts = [`[AUTH] ${event.type}`]
  if (event.reason) parts.push(`reason=${event.reason}`)
  parts.push(`source=${event.source}`)
  if (event.url) parts.push(`url=${event.url}`)
  if (event.type === 'SILENT_FAILURE' && event.recovered !== undefined) {
    parts.push(`recovered=${event.recovered}`)
  }
  parts.push(`ts=${event.ts}`)
  const msg = parts.join(' | ')
  console.warn(msg)
  _persistLog(msg)
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
