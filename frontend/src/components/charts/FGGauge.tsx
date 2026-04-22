/* SQZ Terminal — Fear & Greed 반원 게이지.
   원본: /tmp/design_extract/asst/project/atoms.jsx FGGauge */

interface FGGaugeProps {
  value?: number
  size?: number
}

export default function FGGauge({ value = 68, size = 200 }: FGGaugeProps) {
  const r = size * 0.4
  const cx = size / 2
  const cy = size * 0.62
  const segs = [
    { from: 0, to: 0.2, color: 'oklch(0.55 0.22 25)' },
    { from: 0.2, to: 0.4, color: 'oklch(0.65 0.18 45)' },
    { from: 0.4, to: 0.6, color: 'oklch(0.75 0.12 85)' },
    { from: 0.6, to: 0.8, color: 'oklch(0.7 0.15 145)' },
    { from: 0.8, to: 1, color: 'oklch(0.65 0.2 150)' },
  ]

  const arc = (from: number, to: number, color: string) => {
    const a1 = Math.PI + from * Math.PI
    const a2 = Math.PI + to * Math.PI
    const x1 = cx + Math.cos(a1) * r
    const y1 = cy + Math.sin(a1) * r
    const x2 = cx + Math.cos(a2) * r
    const y2 = cy + Math.sin(a2) * r
    return (
      <path
        key={from}
        d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`}
        stroke={color}
        strokeWidth={size * 0.1}
        fill="none"
        strokeLinecap="butt"
      />
    )
  }

  const t = value / 100
  const na = Math.PI + t * Math.PI
  const nx = cx + Math.cos(na) * (r * 0.95)
  const ny = cy + Math.sin(na) * (r * 0.95)

  const mood =
    value >= 75 ? '낙관적' : value >= 55 ? '긍정' : value >= 45 ? '중립' : value >= 25 ? '우려' : '공포'
  const moodColor =
    value >= 55 ? 'var(--up)' : value >= 45 ? 'var(--warn)' : 'var(--down)'

  return (
    <svg width={size} height={size * 0.82}>
      {segs.map(s => arc(s.from, s.to, s.color))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#fff" />
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fill="var(--fg-0)"
        fontSize={size * 0.18}
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy + size * 0.15}
        textAnchor="middle"
        fill="var(--fg-2)"
        fontSize={size * 0.07}
        fontWeight="500"
      >
        FEAR & GREED
      </text>
      <text
        x={cx}
        y={cy + size * 0.26}
        textAnchor="middle"
        fill={moodColor}
        fontSize={size * 0.075}
        fontWeight="600"
      >
        {mood}
      </text>
    </svg>
  )
}
