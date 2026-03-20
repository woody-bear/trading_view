import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MarketScanBox } from './Dashboard'

export default function Scan() {
  const nav = useNavigate()
  const qc = useQueryClient()

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <MarketScanBox nav={nav} qc={qc} />
    </div>
  )
}
