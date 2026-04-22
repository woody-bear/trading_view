import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TopNav from './components/TopNav'
import { AuthProvider } from './components/AuthProvider'
import { useWebSocket } from './hooks/useWebSocket'
import Dashboard from './pages/Dashboard'
import Scan from './pages/Scan'
import Settings from './pages/Settings'
import SignalDetail from './pages/SignalDetail'
import AlertHistory from './pages/AlertHistory'
import BuyList from './pages/BuyList'
import Scrap from './pages/Scrap'
import AuthCallback from './pages/AuthCallback'
import Forex from './pages/Forex'
import ScanConditions from './pages/ScanConditions'
import Toast from './components/ui/Toast'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: false, retry: 1 } },
})

function AppInner() {
  useWebSocket()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* PC 상단 네비 (SQZ Terminal, 1280px 이상에서 표시) */}
      <TopNav />

      {/* 메인 콘텐츠 — 모바일에서 하단바 높이만큼 패딩 */}
      <main className="pb-[68px] md:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/alerts" element={<AlertHistory />} />
          <Route path="/buy-list" element={<BuyList />} />
          <Route path="/scrap" element={<Scrap />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forex" element={<Forex />} />
          <Route path="/conditions" element={<ScanConditions />} />
          <Route path="/:symbol" element={<SignalDetail />} />
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
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
