import { useEffect, useRef, useState } from 'react'

interface FlowchartViewProps {
  diagram: string
  id: string
  dark?: boolean
}

type ViewState = 'loading' | 'ready' | 'error'

// PC 전용 Mermaid 렌더러. 모바일에서는 ConditionsSection이 이 컴포넌트를 마운트하지 않음 →
// mermaid 번들은 PC 화면에서만 동적으로 로드된다.
export default function FlowchartView({ diagram, id, dark = true }: FlowchartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ViewState>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          securityLevel: 'loose',
          flowchart: { htmlLabels: true, curve: 'basis' },
        })
        const { svg } = await mermaid.render(`${id}-svg`, diagram)
        if (cancelled) return
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          setState('ready')
        }
      } catch (err) {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : String(err))
        setState('error')
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [diagram, id, dark])

  if (state === 'error') {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
        <p className="text-sm font-semibold text-red-400 mb-2">플로우차트 렌더 실패</p>
        <p className="text-xs text-red-300 mb-3">{errorMsg}</p>
        <pre className="text-xs text-[var(--muted)] bg-[var(--bg)] p-2 rounded overflow-x-auto">{diagram}</pre>
      </div>
    )
  }

  return (
    <div className="relative">
      {state === 'loading' && (
        <div className="text-xs text-[var(--muted)] py-8 text-center">플로우차트 로딩 중…</div>
      )}
      <div ref={containerRef} className="mermaid-container" aria-label={`${id} 흐름도`} />
    </div>
  )
}
