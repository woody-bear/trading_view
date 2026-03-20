import { useEffect, useRef } from 'react'
import { useSignalStore } from '../stores/signalStore'
import type { PriceUpdate } from '../stores/signalStore'

// 가격 업데이트를 구독하는 리스너들
type PriceListener = (updates: PriceUpdate[]) => void
const priceListeners = new Set<PriceListener>()

export function onPriceUpdate(listener: PriceListener) {
  priceListeners.add(listener)
  return () => { priceListeners.delete(listener) }
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const updateSignal = useSignalStore((s) => s.updateSignal)
  const updatePrices = useSignalStore((s) => s.updatePrices)

  useEffect(() => {
    let delay = 1000
    let timer: ReturnType<typeof setTimeout>

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => { delay = 1000 }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'signal_update') {
            updateSignal(msg.data)
          } else if (msg.type === 'price_update') {
            const updates: PriceUpdate[] = msg.data
            updatePrices(updates)
            // 리스너들에게 전파 (차트 등)
            priceListeners.forEach((fn) => fn(updates))
          }
        } catch {}
      }
      ws.onclose = () => {
        timer = setTimeout(connect, Math.min(delay, 30000))
        delay *= 2
      }
    }

    connect()
    return () => { wsRef.current?.close(); clearTimeout(timer) }
  }, [updateSignal, updatePrices])
}
