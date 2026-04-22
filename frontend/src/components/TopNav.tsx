/* SQZ Terminal — PC TopNav (Phase 5)
   원본 디자인: /tmp/design_extract/asst/project/pc-dashboard.jsx PcTopNav
   1280px 이상에서만 표시. 그 미만은 BottomNav. */

import { useQuery } from '@tanstack/react-query'
import { Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchFullScanLatest } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { LoginButton } from './LoginButton'
import { UserMenu } from './UserMenu'

interface TabDef {
  id: string
  label: string
  path: string
  badgeKey?: 'buy' | 'buylist'
}

const TABS: TabDef[] = [
  { id: 'market', label: '마켓', path: '/' },
  { id: 'scan', label: '스캔', path: '/scan', badgeKey: 'buy' },
  { id: 'buylist', label: '조회종목', path: '/buy-list', badgeKey: 'buylist' },
  { id: 'scrap', label: '기록', path: '/scrap' },
  { id: 'conditions', label: '파이프라인', path: '/conditions' },
]

function isKrxOpen(now: Date): boolean {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const d = kst.getDay()
  if (d === 0 || d === 6) return false
  const h = kst.getHours()
  const m = kst.getMinutes()
  return h >= 9 && (h < 15 || (h === 15 && m <= 30))
}

function isUsOpen(now: Date): boolean {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const d = et.getDay()
  if (d === 0 || d === 6) return false
  const h = et.getHours()
  const m = et.getMinutes()
  return (h > 9 || (h === 9 && m >= 30)) && h < 16
}

function fmtKst(now: Date): string {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const mm = String(kst.getMonth() + 1).padStart(2, '0')
  const dd = String(kst.getDate()).padStart(2, '0')
  const hh = String(kst.getHours()).padStart(2, '0')
  const mi = String(kst.getMinutes()).padStart(2, '0')
  return `${mm}.${dd} · ${hh}:${mi} KST`
}

// 시계 — 1초 setInterval을 TopNav 전역에서 격리. 이 컴포넌트만 매 초 리렌더됨.
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const krxOpen = isKrxOpen(now)
  const usOpen = isUsOpen(now)
  return (
    <div
      className="flex items-center"
      style={{ gap: 14, fontFamily: 'var(--font-mono)', fontSize: 11 }}
    >
      <div className="flex items-center gap-1.5">
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: krxOpen ? 'var(--up)' : 'var(--down)',
          }}
        />
        <span style={{ color: 'var(--fg-3)' }}>KRX</span>
        <span style={{ color: 'var(--fg-1)' }}>{krxOpen ? 'LIVE' : 'CLOSED'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: usOpen ? 'var(--up)' : 'var(--down)',
          }}
        />
        <span style={{ color: 'var(--fg-3)' }}>US</span>
        <span style={{ color: 'var(--fg-1)' }}>{usOpen ? 'LIVE' : 'CLOSED'}</span>
      </div>
      <div
        style={{
          color: 'var(--fg-2)',
          paddingLeft: 12,
          borderLeft: '1px solid var(--border)',
        }}
      >
        {fmtKst(now)}
      </div>
    </div>
  )
}

function focusSearch(nav: ReturnType<typeof useNavigate>) {
  nav('/')
  setTimeout(() => {
    const el = document.querySelector<HTMLInputElement>('[data-search-box] input')
    el?.focus()
  }, 80)
}

export default function TopNav() {
  const location = useLocation()
  const nav = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        focusSearch(nav)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [nav])

  const { data: scan } = useQuery({
    queryKey: ['topnav-scan-summary'],
    queryFn: fetchFullScanLatest,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const chartBuyCount: number | null = scan?.chart_buy?.total ?? null
  const totalSymbols: number | null = scan?.chart_buy?.universe_total ?? null

  const badges: Record<string, number | null> = {
    buy: chartBuyCount,
    buylist: totalSymbols,
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="hidden md:flex sticky top-0 z-40 items-stretch"
      style={{
        height: 44,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-0)',
        padding: '0 16px',
      }}
    >
      {/* Logo */}
      <a href="/" className="flex items-center shrink-0" style={{ marginRight: 24 }}>
        <div style={{ fontWeight: 400, letterSpacing: '0.02em', fontSize: 20, color: 'var(--fg-0)', fontFamily: "'Yeon Sung', cursive", lineHeight: 1 }}>
          추세
        </div>
      </a>

      {/* Tabs */}
      <div className="flex items-stretch h-full">
        {TABS.map(tab => {
          const active = isActive(tab.path)
          const badge = tab.badgeKey ? badges[tab.badgeKey] : null
          return (
            <button
              key={tab.id}
              onClick={() => nav(tab.path)}
              className="flex items-center gap-1.5 cursor-pointer"
              style={{
                padding: '0 14px',
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: active ? 'var(--fg-0)' : 'var(--fg-3)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
              }}
            >
              {tab.label}
              {badge != null && (
                <span
                  style={{
                    fontSize: 10, padding: '1px 4px',
                    background: 'var(--bg-2)',
                    color: 'var(--fg-2)',
                    borderRadius: 2,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* spacer */}
      <div className="flex-1" />

      {/* Market clock — 격리 컴포넌트 (1초 setInterval이 TopNav 전체를 리렌더하지 않도록) */}
      <Clock />

      {/* ⌘K SEARCH — UI only (기존 대시보드 검색 UX 유지, 추후 전역 커맨드 팔레트 연결 예정) */}
      <button
        onClick={() => focusSearch(nav)}
        style={{
          marginLeft: 16,
          height: 26, alignSelf: 'center',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--fg-1)',
          padding: '0 10px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          borderRadius: 3,
        }}
      >
        ⌘K SEARCH
      </button>

      {/* 기존 기능 유지: 설정 + 사용자 메뉴 */}
      <div className="flex items-center gap-3" style={{ marginLeft: 16 }}>
        <a
          href="/settings"
          style={{ color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}
          title="설정"
        >
          <SettingsIcon size={18} />
        </a>
        {user ? <UserMenu /> : <LoginButton />}
      </div>
    </nav>
  )
}
