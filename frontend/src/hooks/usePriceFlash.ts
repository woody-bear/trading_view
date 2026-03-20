import { useEffect, useRef, useState } from 'react'

/**
 * 가격 변동 시 깜빡임 효과를 제공하는 훅.
 * 가격이 오르면 'up', 내리면 'down', 변화 없으면 null 반환.
 * 0.8초 후 자동으로 null로 복귀.
 */
export function usePriceFlash(price: number | undefined) {
  const prevPrice = useRef(price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (price != null && prevPrice.current != null && price !== prevPrice.current) {
      setFlash(price > prevPrice.current ? 'up' : 'down')
      prevPrice.current = price
      const t = setTimeout(() => setFlash(null), 800)
      return () => clearTimeout(t)
    }
    prevPrice.current = price
  }, [price])

  const flashClass =
    flash === 'up' ? 'animate-pulse text-green-400'
    : flash === 'down' ? 'animate-pulse text-red-400'
    : 'text-white'

  return { flash, flashClass }
}
