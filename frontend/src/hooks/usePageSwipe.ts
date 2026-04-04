import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const PAGE_ORDER = ['/', '/buy-list', '/settings']
const THRESHOLD = 80

/**
 * 스냅 컨테이너에 페이지/섹션 간 스와이프 내비게이션을 추가한다.
 *
 * - 다음 페이지로 이동: 마지막 스냅 섹션에서 위 스와이프 → PAGE_ORDER 다음 페이지 첫 섹션
 * - 이전 페이지로 이동: 첫 스냅 섹션에서 아래 스와이프 → PAGE_ORDER 이전 페이지 **마지막 섹션**
 *   → navigate state에 { _snapStart: 'last' }를 전달하여 도착 페이지가 마지막 섹션부터 시작
 */
export function usePageSwipe(snapRef: React.RefObject<HTMLDivElement | null>) {
  const nav = useNavigate()
  const location = useLocation()
  const locRef = useRef(location.pathname)
  const startY = useRef(0)
  const startX = useRef(0)
  const innerAtTop = useRef(true)
  const innerAtBottom = useRef(true)

  useEffect(() => { locRef.current = location.pathname }, [location.pathname])

  // 이전 페이지에서 역방향 도착 시 → 마지막 스냅 섹션으로 즉시 이동
  useEffect(() => {
    if ((location.state as any)?._snapStart !== 'last') return
    const el = snapRef.current
    if (!el) return
    // 두 번의 rAF: 스냅 섹션들이 DOM에 완전히 그려진 후 스크롤
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - el.clientHeight
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = snapRef.current
    if (!el) return

    // 터치 대상에서 가장 가까운 내부 스크롤 컨테이너를 찾는다
    const findInnerScroll = (target: Element): Element | null => {
      let cur: Element | null = target
      while (cur && cur !== el) {
        const oy = window.getComputedStyle(cur).overflowY
        if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 2) {
          return cur
        }
        cur = cur.parentElement
      }
      return null
    }

    const onStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX

      // touchstart 시점의 내부 스크롤 경계 상태 기록 (touchend 시점이 아님)
      const inner = findInnerScroll(e.target as Element)
      if (inner) {
        innerAtTop.current = inner.scrollTop <= 2
        innerAtBottom.current = inner.scrollTop >= inner.scrollHeight - inner.clientHeight - 2
      } else {
        innerAtTop.current = true
        innerAtBottom.current = true
      }
    }

    const onEnd = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - startY.current
      const dx = e.changedTouches[0].clientX - startX.current
      if (Math.abs(dx) > Math.abs(dy) * 0.9) return
      if (Math.abs(dy) < THRESHOLD) return

      const snapAtFirst = el.scrollTop < 10
      const snapAtLast = el.scrollTop > el.scrollHeight - el.clientHeight - 10
      const idx = PAGE_ORDER.indexOf(locRef.current)
      if (idx === -1) return

      if (dy > 0 && innerAtTop.current) {
        // 아래 스와이프 (이전으로)
        if (snapAtFirst) {
          // 이전 페이지의 마지막 섹션에서 시작하도록 state 전달
          if (idx > 0) nav(PAGE_ORDER[idx - 1], { state: { _snapStart: 'last' } })
        } else {
          // 이전 스냅 섹션으로 이동
          const snapIdx = Math.round(el.scrollTop / el.clientHeight)
          el.scrollTo({ top: Math.max(0, (snapIdx - 1) * el.clientHeight), behavior: 'instant' as ScrollBehavior })
        }
      } else if (dy < 0 && innerAtBottom.current) {
        // 위 스와이프 (다음으로)
        if (snapAtLast) {
          // 다음 페이지의 첫 섹션부터 시작 (기본 동작)
          if (idx < PAGE_ORDER.length - 1) nav(PAGE_ORDER[idx + 1])
        } else {
          // 다음 스냅 섹션으로 이동
          const snapIdx = Math.round(el.scrollTop / el.clientHeight)
          const maxTop = el.scrollHeight - el.clientHeight
          el.scrollTo({ top: Math.min(maxTop, (snapIdx + 1) * el.clientHeight), behavior: 'instant' as ScrollBehavior })
        }
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
