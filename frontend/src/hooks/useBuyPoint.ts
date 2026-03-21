import { useCallback, useEffect, useState } from 'react'
import { useToastStore } from '../stores/toastStore'

export interface BuyPoint {
  symbol: string
  price: number
  date: string
  markerTime: number
}

function lsKey(symbol: string) {
  return `buyPoints:${symbol}`
}

function tryRead(symbol: string): BuyPoint | null {
  try {
    const raw = localStorage.getItem(lsKey(symbol))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function tryWrite(symbol: string, point: BuyPoint): boolean {
  try {
    localStorage.setItem(lsKey(symbol), JSON.stringify(point))
    return true
  } catch {
    return false
  }
}

function tryRemove(symbol: string): boolean {
  try {
    localStorage.removeItem(lsKey(symbol))
    return true
  } catch {
    return false
  }
}

export function useBuyPoint(symbol: string) {
  const [buyPoint, setBuyPointState] = useState<BuyPoint | null>(() => tryRead(symbol))
  const [lsFallback, setLsFallback] = useState(false)
  const { addToast } = useToastStore()

  useEffect(() => {
    setBuyPointState(tryRead(symbol))
  }, [symbol])

  const setBuyPoint = useCallback((point: BuyPoint) => {
    setBuyPointState(point)
    if (!tryWrite(symbol, point) && !lsFallback) {
      setLsFallback(true)
      addToast('info', '매수지점이 이 세션에서만 유지됩니다')
    }
  }, [symbol, lsFallback, addToast])

  const removeBuyPoint = useCallback(() => {
    setBuyPointState(null)
    tryRemove(symbol)
  }, [symbol])

  const toggleBuyPoint = useCallback((point: BuyPoint) => {
    if (buyPoint && buyPoint.markerTime === point.markerTime) {
      removeBuyPoint()
    } else {
      setBuyPoint(point)
    }
  }, [buyPoint, setBuyPoint, removeBuyPoint])

  return { buyPoint, setBuyPoint, removeBuyPoint, toggleBuyPoint }
}
