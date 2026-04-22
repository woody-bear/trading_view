import { BarChart3, BookMarked, LayoutDashboard, List, Settings } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', icon: LayoutDashboard, label: '마켓' },
  { path: '/scan', icon: BarChart3, label: '스캔' },
  { path: '/buy-list', icon: List, label: '종목' },
  { path: '/scrap', icon: BookMarked, label: '기록' },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t backdrop-blur-md"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'color-mix(in oklch, var(--bg-1), transparent 8%)',
        borderColor: 'var(--border)',
      }}>
      <div className="flex items-center justify-around h-[64px]">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          const color = active ? 'var(--accent)' : 'var(--fg-3)'
          return (
            <button
              key={tab.path}
              onClick={() => nav(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
              style={{ color }}
            >
              <tab.icon size={26} strokeWidth={active ? 2.2 : 1.5} />
              <span
                className="text-label leading-none"
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
