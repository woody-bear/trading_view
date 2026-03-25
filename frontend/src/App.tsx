import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Settings as SettingsIcon } from 'lucide-react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { useWebSocket } from './hooks/useWebSocket'
import Dashboard from './pages/Dashboard'
import Forex from './pages/Forex'
import Scan from './pages/Scan'
import Settings from './pages/Settings'
import SignalDetail from './pages/SignalDetail'
import AlertHistory from './pages/AlertHistory'
import TopPicks from './pages/TopPicks'
import Toast from './components/ui/Toast'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: false } },
})

function AppInner() {
  useWebSocket()
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* PC 상단 네비 (모바일 숨김) */}
      <nav className="hidden md:flex bg-[var(--navy)] border-b border-[var(--border)] px-6 py-3 items-center">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg font-bold text-[var(--gold)]">추세추종 연구소</span>
        </a>
        <div className="flex items-center gap-6 ml-6">
          <a href="/picks" className="text-[var(--gold)] hover:text-yellow-300 text-sm font-semibold">추천</a>
          <a href="/forex" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">환율</a>
        </div>
        <a href="/settings" className="ml-auto text-[var(--muted)] hover:text-[var(--gold)] transition" title="설정">
          <SettingsIcon size={18} />
        </a>
      </nav>

      {/* 메인 콘텐츠 — 모바일에서 하단바 높이만큼 패딩 */}
      <main className="pb-[68px] md:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/picks" element={<TopPicks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/alerts" element={<AlertHistory />} />
          <Route path="/:symbol" element={<SignalDetail />} />
          <Route path="/forex" element={<Forex />} />
        </Routes>
      </main>

      {/* PC footer (모바일 숨김) */}
      <footer className="hidden md:block border-t border-[var(--border)] px-3 py-3 text-center text-[9px] text-[var(--muted)]">
        © 2026 추세추종 연구소
      </footer>

      {/* 모바일 하단 네비 */}
      <BottomNav />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
