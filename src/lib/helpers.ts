/** 4.25 -> "4,25" ; gereksiz sifirlari atar */
export function qty(n: number | null | undefined, unit?: string): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '-'
  const v = Number(n)
  const s = v
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',')
  return unit ? `${s} ${unit}` : s
}

export function dt(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const date = d.toLocaleDateString('tr-TR')
  return withTime ? `${date} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : date
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function shelfCode(section: string, shelf: number | string, level?: number | string | null, bin?: number | string | null) {
  const pad = (v: number | string) => String(v).padStart(2, '0')
  let code = `${section}-${pad(shelf)}`
  if (level !== null && level !== undefined && level !== '') code += `-${pad(level)}`
  if (bin !== null && bin !== undefined && bin !== '') code += `-${pad(bin)}`
  return code
}

/** Excel'in Turkce yerel ayarlariyla uyumlu CSV (noktali virgul + BOM) */
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = [headers.map(esc).join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** QR icerigi tam URL de olabilir, duz numune no da. Ikisinden de numune no cikarir. */
export function parseSampleNo(text: string): string | null {
  const t = text.trim()
  const direct = t.match(/ARGE-\d{4}-\d{4,}/i)
  return direct ? direct[0].toUpperCase() : null
}
