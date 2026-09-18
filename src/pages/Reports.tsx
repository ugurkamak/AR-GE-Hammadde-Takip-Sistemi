import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { dt, exportCsv, qty } from '../lib/helpers'
import { RESULT_LABEL, STATUS_LABEL } from '../lib/constants'
import type { Material, TestRecord, Usage } from '../lib/types'

const REPORTS = [
  { id: 'gelen', label: 'Gelen hammaddeler' },
  { id: 'kullanim', label: 'Kullanim raporu' },
  { id: 'kullanici', label: 'Kullanici bazli kullanim' },
  { id: 'firma', label: 'Firma bazli hammadde' },
  { id: 'olumlu', label: 'Olumlu sonuclar' },
  { id: 'olumsuz', label: 'Olumsuz sonuclar' },
  { id: 'bekleyen', label: 'Test bekleyenler' },
  { id: 'kritik', label: 'Kritik stoklar' },
  { id: 'biten', label: 'Biten hammaddeler' },
  { id: 'raf', label: 'Raf raporu' },
]

export default function Reports() {
  const [report, setReport] = useState('gelen')
  const [materials, setMaterials] = useState<Material[]>([])
  const [usages, setUsages] = useState<Usage[]>([])
  const [tests, setTests] = useState<TestRecord[]>([])
  const [f, setF] = useState({ from: '', to: '', supplier: '', material: '', lot: '', user: '', result: '', status: '', shelf: '' })

  useEffect(() => {
    supabase.from('materials_view').select('*').then(({ data }) => setMaterials((data as Material[]) ?? []))
    supabase.from('usages').select('*, profiles(full_name), materials(name, sample_no, unit, supplier, shelf_code)')
      .order('created_at', { ascending: false }).limit(2000)
      .then(({ data }) => setUsages((data as Usage[]) ?? []))
    supabase.from('test_results').select('*, profiles(full_name), materials(name, sample_no)')
      .order('created_at', { ascending: false }).limit(2000)
      .then(({ data }) => setTests((data as TestRecord[]) ?? []))
  }, [])

  const inRange = (iso: string) => (!f.from || iso >= f.from) && (!f.to || iso <= f.to + 'T23:59:59')
  const txt = (v: string | null | undefined, needle: string) =>
    !needle || (v ?? '').toLocaleLowerCase('tr').includes(needle.toLocaleLowerCase('tr'))

  const mats = useMemo(
    () => materials.filter((m) =>
      inRange(m.arrival_date) && txt(m.supplier, f.supplier) && txt(m.name, f.material) &&
      txt(m.lot_no, f.lot) && txt(m.shelf_code, f.shelf) &&
      (!f.result || m.test_result === f.result) && (!f.status || m.status === f.status)),
    [materials, f],
  )
  const uses = useMemo(
    () => usages.filter((u) =>
      u.is_used && inRange(u.created_at) && txt(u.profiles?.full_name, f.user) &&
      txt(u.materials?.name, f.material) && txt(u.materials?.supplier, f.supplier) && txt(u.materials?.shelf_code, f.shelf)),
    [usages, f],
  )

  const byUser = useMemo(() => {
    const map: Record<string, { user: string; adet: number }> = {}
    uses.forEach((u) => {
      const k = u.profiles?.full_name ?? 'Bilinmiyor'
      map[k] ??= { user: k, adet: 0 }
      map[k].adet += 1
    })
    return Object.values(map).sort((a, b) => b.adet - a.adet)
  }, [uses])

  const bySupplier = useMemo(() => {
    const map: Record<string, { firma: string; adet: number }> = {}
    mats.forEach((m) => {
      map[m.supplier] ??= { firma: m.supplier, adet: 0 }
      map[m.supplier].adet += 1
    })
    return Object.values(map).sort((a, b) => b.adet - a.adet)
  }, [mats])

  const matRows = (list: Material[]) =>
    list.map((m) => ({
      'Numune No': m.sample_no, Hammadde: m.name, Firma: m.supplier, 'Lot No': m.lot_no,
      'Gelis Tarihi': m.arrival_date, 'Mevcut Stok': m.current_stock, Birim: m.unit,
      'Min Stok': m.min_stock, 'Raf Yeri': m.shelf_code, Durum: STATUS_LABEL[m.status], Sonuc: RESULT_LABEL[m.test_result],
    }))

  const data = useMemo(() => {
    switch (report) {
      case 'gelen': return matRows(mats)
      case 'kullanim': return uses.map((u) => ({
        Tarih: dt(u.created_at), Kullanici: u.profiles?.full_name ?? '', Numune: u.materials?.sample_no ?? '',
        Hammadde: u.materials?.name ?? '', Miktar: u.quantity, Birim: u.unit, Proje: u.project ?? '', Deneme: u.trial_no ?? '',
      }))
      case 'kullanici': return byUser.map((r) => ({ Kullanici: r.user, 'Kullanim Adedi': r.adet }))
      case 'firma': return bySupplier.map((r) => ({ Firma: r.firma, 'Numune Adedi': r.adet }))
      case 'olumlu': return matRows(mats.filter((m) => m.test_result === 'olumlu'))
      case 'olumsuz': return matRows(mats.filter((m) => m.test_result === 'olumsuz'))
      case 'bekleyen': return matRows(mats.filter((m) => m.test_result === 'bekliyor'))
      case 'kritik': return matRows(mats.filter((m) => m.is_critical))
      case 'biten': return matRows(mats.filter((m) => m.is_empty))
      case 'raf': return [...mats].sort((a, b) => a.shelf_code.localeCompare(b.shelf_code)).map((m) => ({
        'Raf Yeri': m.shelf_code, 'Numune No': m.sample_no, Hammadde: m.name, Firma: m.supplier,
        'Mevcut Stok': m.current_stock, Birim: m.unit,
      }))
      default: return []
    }
  }, [report, mats, uses, byUser, bySupplier])

  const cols = data.length ? Object.keys(data[0]) : []

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Raporlar</h1>
          <p>Filtreleri uygulayin, tabloyu inceleyin, Excel icin CSV olarak indirin.</p>
        </div>
        <div className="btn-row no-print">
          <button onClick={() => window.print()}>Yazdir</button>
          <button className="btn-primary" onClick={() => exportCsv(report, data as any)} disabled={!data.length}>CSV indir</button>
        </div>
      </div>

      <div className="card mb no-print">
        <div className="card-b">
          <div className="filters">
            <div className="field"><label>Rapor</label>
              <select value={report} onChange={(e) => setReport(e.target.value)}>
                {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select></div>
            <div className="field"><label>Baslangic</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
            <div className="field"><label>Bitis</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
            <div className="field"><label>Firma</label><input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
            <div className="field"><label>Hammadde</label><input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} /></div>
            <div className="field"><label>Lot</label><input value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /></div>
            <div className="field"><label>Kullanici</label><input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></div>
            <div className="field"><label>Sonuc</label>
              <select value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}>
                <option value="">Tumu</option>
                {Object.entries(RESULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="field"><label>Durum</label>
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="">Tumu</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="field"><label>Raf</label><input value={f.shelf} onChange={(e) => setF({ ...f, shelf: e.target.value })} placeholder="A-03" /></div>
          </div>
        </div>
      </div>

      {(report === 'kullanici' || report === 'firma') && data.length > 0 && (
        <div className="card mb">
          <div className="card-b" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(report === 'kullanici' ? byUser : bySupplier) as any}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e9e5" />
                <XAxis dataKey={report === 'kullanici' ? 'user' : 'firma'} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="adet" fill="#e0a526" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h"><h2>{REPORTS.find((r) => r.id === report)?.label}</h2><span className="small muted">{data.length} satir</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {data.map((row: any, i) => (
                <tr key={i}>{cols.map((c) => <td key={c}>{typeof row[c] === 'number' && c.includes('Stok') ? qty(row[c]) : String(row[c] ?? '')}</td>)}</tr>
              ))}
              {!data.length && <tr><td className="empty"><strong>Sonuc yok</strong>Filtreleri genisletmeyi deneyin.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
