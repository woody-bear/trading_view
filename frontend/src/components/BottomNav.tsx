import { BarChart3, BookMarked, Home, Settings, TrendingUp } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', icon: Home, label: '홈' },
  { path: '/scan', icon: BarChart3, label: '스캔' },
  { path: '/buy-list', icon: TrendingUp, label: 'BUY종목' },
  { path: '/scrap', icon: BookMarked, label: '스크랩' },
  { path: '/settings', icon: Settings, label: '설정' },
]

export default function BottomNav() {
  const location = useLocation()
  const nav = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-[var(--border)] bg-black/85 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-[64px]">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => nav(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            >
              <tab.icon size={26} className={active ? 'text-[var(--buy)]' : 'text-[var(--neutral)]'} strokeWidth={active ? 2.2 : 1.5} />
              <span className={`text-label leading-none ${active ? 'text-[var(--buy)] font-semibold' : 'text-[var(--neutral)]'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
