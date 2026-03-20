import { BarChart3, DollarSign, Home, Settings, Star } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', icon: Home, label: '홈' },
  { path: '/scan', icon: BarChart3, label: '스캔' },
  { path: '/forex', icon: DollarSign, label: '환율' },
  { path: '/picks', icon: Star, label: '추천' },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-[52px]">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => nav(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              <tab.icon size={22} className={active ? 'text-[var(--gold)]' : 'text-[var(--muted)]'} strokeWidth={active ? 2.2 : 1.5} />
              <span className={`text-[10px] leading-none ${active ? 'text-[var(--gold)] font-semibold' : 'text-[var(--muted)]'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
