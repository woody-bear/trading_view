import { useQuery } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import {
  fetchCrisisEvents,
  fetchCrisisEventIndicators,
  fetchCrisisEventStats,
  fetchCrisisDefaultComparison,
  fetchCrisisCompare,
} from '../api/client'
import CrisisEventList from '../components/crisis/CrisisEventList'
import CrisisIndicatorChart from '../components/crisis/CrisisIndicatorChart'
import CrisisStatCard from '../components/crisis/CrisisStatCard'
import CrisisCompareChart from '../components/crisis/CrisisCompareChart'
import CrisisCustomBaseline from '../components/crisis/CrisisCustomBaseline'

interface CrisisEvent {
  id: number
  name: string
  event_type: string
  start_date: string
  end_date: string | null
  is_ongoing: boolean
  severity_level: string
  description: string
  has_comparison: boolean
}

// 이벤트 선택 모드: 'detail' (단일 이벤트 차트) | 'compare' (비교 차트)
type ViewMode = 'detail' | 'compare'

const COMPARE_INDICATOR_OPTIONS = [
  { id: 1, name: 'S&P 500' },
  { id: 2, name: 'KOSPI' },
  { id: 5, name: 'Gold' },
  { id: 6, name: 'WTI Oil' },
]

export default function Crisis() {
  const [filterType, setFilterType] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('compare')
  const [compareIndicatorId, setCompareIndicatorId] = useState(1)
  const [compareDays, setCompareDays] = useState(90)
  const [customBaselineDates, setCustomBaselineDates] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // 이벤트 목록
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['crisisEvents', filterType],
    queryFn: () => fetchCrisisEvents(filterType || undefined),
  })
  const events: CrisisEvent[] = eventsData?.events || []

  // 진입 시 자동 비교 데이터 로드
  const { data: defaultComparison, isLoading: defaultLoading } = useQuery({
    queryKey: ['crisisDefaultComparison'],
    queryFn: fetchCrisisDefaultComparison,
    staleTime: 5 * 60 * 1000,
  })

  // 비교 차트 데이터 (API: current_event.id / comparison_event.id)
  const compareEventIds: (number | 'custom')[] = [
    ...(defaultComparison?.current_event?.id ? [defaultComparison.current_event.id] : []),
    ...(defaultComparison?.comparison_event?.id ? [defaultComparison.comparison_event.id] : []),
    ...customBaselineDates.map(() => 'custom' as const),
  ]

  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['crisisCompare', compareEventIds, compareIndicatorId, compareDays, customBaselineDates],
    queryFn: () => fetchCrisisCompare(
      compareEventIds,
      compareIndicatorId,
      compareDays,
      customBaselineDates[0] // 최신 커스텀 날짜 사용
    ),
    enabled: compareEventIds.length > 0 && viewMode === 'compare',
    staleTime: 60 * 1000,
  })

  // 단일 이벤트 지표 데이터
  const { data: indicatorData, isLoading: indicatorLoading } = useQuery({
    queryKey: ['crisisIndicators', selectedEvent?.id],
    queryFn: () => fetchCrisisEventIndicators(selectedEvent!.id, 30, 180),
    enabled: !!selectedEvent && viewMode === 'detail',
    staleTime: 5 * 60 * 1000,
  })

  // 단일 이벤트 통계
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['crisisStats', selectedEvent?.id],
    queryFn: () => fetchCrisisEventStats(selectedEvent!.id),
    enabled: !!selectedEvent && viewMode === 'detail',
    staleTime: 5 * 60 * 1000,
  })

  // 이벤트 선택 시 detail 모드 전환
  const handleSelectEvent = (event: CrisisEvent) => {
    setSelectedEvent(event)
    setViewMode('detail')
  }

  // 커스텀 기준선 추가
  const handleAddCustomBaseline = (date: string) => {
    setCustomBaselineDates(prev => [date, ...prev].slice(0, 2))
  }

  // 모바일에서 이벤트 목록 스와이프로 이벤트 전환
  const touchStartX = useRef(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 40 || events.length === 0) return
    const idx = selectedEvent ? events.findIndex(ev => ev.id === selectedEvent.id) : -1
    if (dx < 0 && idx < events.length - 1) {
      handleSelectEvent(events[idx + 1])
    } else if (dx > 0 && idx > 0) {
      handleSelectEvent(events[idx - 1])
    }
  }

  const compareSeries = compareData?.series || []
  const compareIndicatorName = COMPARE_INDICATOR_OPTIONS.find(o => o.id === compareIndicatorId)?.name || 'S&P 500'

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-57px)] overflow-hidden">
      {/* 페이지 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg)]">
        <h1 className="text-sm font-bold text-[var(--text)]">위기 이벤트 분석</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('compare')}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              viewMode === 'compare'
                ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-semibold'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            비교
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              viewMode === 'detail'
                ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-semibold'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            상세
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 이벤트 목록 패널 (PC: 좌측, 모바일: 접힘) */}
        <div
          className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] overflow-hidden"
          ref={listRef}
        >
          {eventsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <CrisisEventList
              events={events}
              selectedId={selectedEvent?.id ?? null}
              onSelect={handleSelectEvent}
              onFilterChange={setFilterType}
            />
          )}
        </div>

        {/* 우측 콘텐츠 */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* 모바일: 이벤트 셀렉터 헤더 (좌우 스와이프) */}
          <div
            className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] overflow-x-auto scrollbar-none"
            style={{ touchAction: 'pan-x' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {eventsLoading ? (
              <div className="text-xs text-[var(--muted)]">로딩중...</div>
            ) : (
              events.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => handleSelectEvent(ev)}
                  className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition ${
                    selectedEvent?.id === ev.id
                      ? 'bg-[var(--navy)] border-[var(--gold)]/60 text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  {ev.is_ongoing && <span className="mr-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse" />}
                  {ev.name}
                </button>
              ))
            )}
          </div>

          {/* 비교 모드 */}
          {viewMode === 'compare' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              {/* 지표 선택 */}
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)]">
                <span className="text-[10px] text-[var(--muted)]">지표:</span>
                {COMPARE_INDICATOR_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setCompareIndicatorId(opt.id)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition ${
                      compareIndicatorId === opt.id
                        ? 'border-[var(--gold)]/60 text-[var(--gold)]'
                        : 'border-[var(--border)] text-[var(--muted)]'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  {[30, 90, 180].map(d => (
                    <button
                      key={d}
                      onClick={() => setCompareDays(d)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition ${
                        compareDays === d
                          ? 'border-[var(--gold)]/60 text-[var(--gold)]'
                          : 'border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* 자동 비교 설명 */}
              {defaultComparison && (
                <div className="shrink-0 px-3 py-1.5 bg-[var(--navy)]/40 border-b border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)]">
                    자동 비교: <span className="text-[var(--gold)]">{defaultComparison.current_event?.name}</span>
                    {' vs '}
                    <span className="text-cyan-400">{defaultComparison.comparison_event?.name}</span>
                  </span>
                </div>
              )}

              {/* 비교 차트 */}
              <div className="flex-1 min-h-[260px]" style={{ touchAction: 'manipulation' }}>
                <CrisisCompareChart
                  series={compareSeries}
                  indicatorName={compareIndicatorName}
                  loading={compareLoading || defaultLoading}
                />
              </div>

              {/* 커스텀 기준선 */}
              <CrisisCustomBaseline
                onAdd={handleAddCustomBaseline}
              />
            </div>
          )}

          {/* 상세 모드 */}
          {viewMode === 'detail' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              {!selectedEvent ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--muted)]">
                  <span className="text-2xl opacity-30">📋</span>
                  <span className="text-xs">이벤트를 선택하세요</span>
                </div>
              ) : (
                <>
                  {/* 선택된 이벤트 헤더 */}
                  <div className="shrink-0 px-3 py-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      {selectedEvent.is_ongoing && (
                        <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">진행중</span>
                      )}
                      <span className="text-sm font-semibold text-[var(--text)]">{selectedEvent.name}</span>
                      <span className="text-[10px] text-[var(--muted)] ml-auto">{selectedEvent.start_date.slice(0, 4)}</span>
                    </div>
                    {selectedEvent.description && (
                      <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2">{selectedEvent.description}</p>
                    )}
                  </div>

                  {/* 지표 차트 */}
                  <div className="flex-1 min-h-[260px]" style={{ touchAction: 'manipulation' }}>
                    <CrisisIndicatorChart
                      indicators={indicatorData?.indicators || []}
                      loading={indicatorLoading}
                    />
                  </div>

                  {/* 통계 카드 */}
                  {!statsLoading && statsData?.stats && (
                    <CrisisStatCard stats={statsData.stats} />
                  )}
                  {statsLoading && (
                    <div className="px-3 py-4 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
