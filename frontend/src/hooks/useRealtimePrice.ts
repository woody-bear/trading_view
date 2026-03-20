import { useEffect, useRef, useState } from 'react'

export interface RealtimePrice {
  price: number
  open: number
  high: number
  low: number
  volume: number
  change_pct: number
}

/**
 * SSE로 단일 종목의 실시간 가격을 1초 간격으로 수신하는 훅.
 * 페이지 이탈 시 자동 연결 해제.
 */
export function useRealtimePrice(symbol: string | undefined, market: string = 'KR') {
  const [livePrice, setLivePrice] = useState<RealtimePrice | null>(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!symbol) return

    const url = `/api/prices/stream/${encodeURIComponent(symbol)}?market=${market}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) {
          setConnected(false)
          return
        }
        setLivePrice(data)
      } catch {}
    }

    es.onerror = () => {
      setConnected(false)
      // EventSource는 자동 재연결 (브라우저 내장)
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)
      setLivePrice(null)
    }
  }, [symbol, market])

  return { livePrice, connected }
}
