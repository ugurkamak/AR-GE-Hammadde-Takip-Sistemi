import { RESULT_LABEL, STATUS_LABEL } from '../lib/constants'
import type { Status, TestResult } from '../lib/types'

export function ResultBadge({ value }: { value: TestResult }) {
  return (
    <span className={`badge b-${value}`}>
      <span className="dot" aria-hidden />
      {RESULT_LABEL[value]}
    </span>
  )
}

export function StatusBadge({ value }: { value: Status }) {
  return <span className={`badge b-${value}`}>{STATUS_LABEL[value]}</span>
}

export function StockBadge({ stock, min, unit }: { stock: number; min: number; unit: string }) {
  if (stock <= 0) return <span className="badge b-bitti">Stok bitti</span>
  if (min > 0 && stock <= min)
    return <span className="badge b-critical">Kritik stok ({min} {unit} alti)</span>
  return null
}
