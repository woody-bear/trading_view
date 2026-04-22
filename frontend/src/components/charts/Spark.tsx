/* SQZ Terminal — Spark (inline SVG sparkline).
   원본: /tmp/design_extract/asst/project/atoms.jsx Spark */

interface SparkProps {
  data: number[]
  w?: number
  h?: number
  color?: string
  fill?: boolean
  strokeW?: number
}

export default function Spark({
  data,
  w = 80,
  h = 24,
  color = 'var(--spark)',
  fill = true,
  strokeW = 1.5,
}: SparkProps) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return [x, y] as const
  })
  const d = 'M' + pts.map(p => p.join(',')).join(' L')
  const area = d + ` L${w},${h} L0,${h} Z`
  const gradId = `spark-g-${color.replace(/\W/g, '')}`

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
        </>
      )}
      <path
        d={d}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
