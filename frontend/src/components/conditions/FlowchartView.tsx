import { useEffect, useRef, useState } from 'react'

interface FlowchartViewProps {
  diagram: string
  id: string
}

type ViewState = 'loading' | 'ready' | 'error'

// PC 전용 Mermaid 렌더러 (xl+ 화면에서만 마운트)
export default function FlowchartView({ diagram, id }: FlowchartViewProps) {
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
          theme: 'default',
          securityLevel: 'loose',
          flowchart: { htmlLabels: true, curve: 'basis' },
          themeVariables: {
            primaryColor: '#f0f4ff',
            primaryBorderColor: '#3b82f6',
            primaryTextColor: '#111827',
            lineColor: '#6b7280',
            secondaryColor: '#f9fafb',
            tertiaryColor: '#f3f4f6',
          },
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
    return () => { cancelled = true }
  }, [diagram, id])

  if (state === 'error') {
    return (
      <div className="panel" style={{ borderColor: 'var(--down)', background: 'var(--down-bg)', padding: 16 }}>
        <div className="label" style={{ color: 'var(--down)', marginBottom: 6 }}>플로우차트 렌더 실패</div>
        <p className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8 }}>{errorMsg}</p>
        <pre style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-2)', padding: 8, borderRadius: 4, overflow: 'auto' }}>{diagram}</pre>
      </div>
    )
  }

  return (
    <div className="panel" style={{ padding: 16, overflow: 'auto' }}>
      {state === 'loading' && (
        <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'center', padding: '32px 0' }}>
          플로우차트 로딩 중…
        </div>
      )}
      <div ref={containerRef} className="mermaid-container" aria-label={`${id} 흐름도`} />
    </div>
  )
}
