import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from '../components/ui/ConnectionIndicator'

export interface RealtimePrice {
  price: number
  open: number
  high: number
  low: number
  volume: number
  change_pct: number
  is_expected?: boolean       // KR 장전/장후 예상 체결가
  is_pre_market?: boolean     // US 프리마켓 실제 체결가 (yfinance)
  is_post_market?: boolean    // US 애프터마켓 실제 체결가 (yfinance)
  market_state?: string       // PRE | POST | REGULAR | CLOSED
}

const MAX_ERRORS = 3

/**
 * SSE로 단일 종목의 실시간 가격을 1초 간격으로 수신하는 훅.
 * 페이지 이탈 시 자동 연결 해제 (FR-008).
 * 연결 상태를 connected/reconnecting/disconnected 3단계로 반환 (FR-005).
 */
export function useRealtimePrice(symbol: string | undefined, market: string = 'KR') {
  const [livePrice, setLivePrice] = useState<RealtimePrice | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const errorCountRef = useRef(0)
  const symbolRef = useRef(symbol)
  const marketRef = useRef(market)

  symbolRef.current = symbol
  marketRef.current = market

  const connect = useCallback(() => {
    const sym = symbolRef.current
    const mkt = marketRef.current
    if (!sym) return

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    errorCountRef.current = 0
    setConnectionStatus('reconnecting')

    const url = `/api/prices/stream/${encodeURIComponent(sym)}?market=${mkt}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      errorCountRef.current = 0
      setConnectionStatus('connected')
    }

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) {
          setConnectionStatus('disconnected')
          return
        }
        errorCountRef.current = 0
        setConnectionStatus('connected')
        setLivePrice(data)
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      errorCountRef.current += 1
      if (errorCountRef.current >= MAX_ERRORS) {
        setConnectionStatus('disconnected')
        es.close()
        eventSourceRef.current = null
      } else {
        setConnectionStatus('reconnecting')
      }
    }
  }, [])

  useEffect(() => {
    if (!symbol) return

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionStatus('disconnected')
      setLivePrice(null)
    }
  }, [symbol, market, connect])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  const connected = connectionStatus === 'connected'

  return { livePrice, connected, connectionStatus, reconnect }
}
