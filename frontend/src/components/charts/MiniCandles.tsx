/* SQZ Terminal — MiniCandles (20봉 미니 캔들스틱).
   원본: /tmp/design_extract/asst/project/atoms.jsx MiniCandles */

import type { Candle } from '../../utils/chartDummy'

interface MiniCandlesProps {
  data: Candle[]
  w?: number
  h?: number
}

export default function MiniCandles({ data, w = 160, h = 44 }: MiniCandlesProps) {
  if (!data || data.length === 0) return null
  const allVals = data.flatMap(c => [c.h, c.l])
  const max = Math.max(...allVals)
  const min = Math.min(...allVals)
  const range = max - min || 1
  const cw = w / data.length
  const scale = (v: number) => h - ((v - min) / range) * (h - 4) - 2

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {data.map((c, i) => {
        const x = i * cw + cw / 2
        const up = c.c >= c.o
        const color = up ? 'var(--up)' : 'var(--down)'
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={scale(c.h)} y2={scale(c.l)} stroke={color} strokeWidth="1" />
            <rect
              x={x - cw * 0.35}
              width={cw * 0.7}
              y={scale(Math.max(c.o, c.c))}
              height={Math.max(1, Math.abs(scale(c.o) - scale(c.c)))}
              fill={color}
            />
          </g>
        )
      })}
    </svg>
  )
}
