import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DetailTabKey } from '../components/DetailTabs'

const VALID: DetailTabKey[] = ['chart', 'value']
const DEFAULT: DetailTabKey = 'chart'

/**
 * URL ?tab=chart|value 동기화 훅.
 * - 잘못된 값/누락 → 'chart' 폴백
 * - 전환은 history push (뒤로가기로 이전 탭 복원)
 */
export function useDetailTab(): [DetailTabKey, (next: DetailTabKey) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab') as DetailTabKey | null
  const tab: DetailTabKey = raw && VALID.includes(raw) ? raw : DEFAULT

  const setTab = useCallback(
    (next: DetailTabKey) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev)
          if (next === DEFAULT) {
            sp.delete('tab')
          } else {
            sp.set('tab', next)
          }
          return sp
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  return [tab, setTab]
}
