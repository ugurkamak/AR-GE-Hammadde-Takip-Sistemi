import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dt, exportCsv, qty } from '../lib/helpers'
import { RESULT_LABEL, STATUS_LABEL } from '../lib/constants'
import { ResultBadge, StatusBadge, StockBadge } from '../components/Badges'
import type { Material } from '../lib/types'
import { useAuth } from '../context/AuthContext'

type SortKey = keyof Material
const FILTERS = [
  { id: 'all', label: 'Tumu' },
  { id: 'depoda', label: 'Depoda' },
  { id: 'kullanimda', label: 'Kullanimda' },
  { id: 'bekliyor', label: 'Test bekliyor' },
  { id: 'olumlu', label: 'Olumlu' },
  { id: 'olumsuz', label: 'Olumsuz' },
  { id: 'kismen', label: 'Kismen olumlu' },
  { id: 'tekrar', label: 'Tekrar test' },
  { id: 'kullanilmadi', label: 'Kullanilmadi' },
  { id: 'kritik', label: 'Kritik stok' },
  { id: 'bitti', label: 'Bitti' },
]

export default function Materials() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'created_at', dir: -1 })

  const active =
    params.get('sonuc') ?? params.get('durum') ?? (params.get('kritik') === '1' ? 'kritik' : 'all')

  useEffect(() => {
    supabase
      .from('materials_view')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows((data as Material[]) ?? [])
        setLoading(false)
      })
  }, [])

  const setFilter = (id: string) => {
    if (id === 'all') return setParams({})
    if (id === 'kritik') return setParams({ kritik: '1' })
    if (['depoda', 'kullanimda', 'bitti'].includes(id)) return setParams({ durum: id })
    setParams({ sonuc: id })
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    let list = rows.filter((m) => {
      if (!term) return true
      return [m.name, m.supplier, m.sample_no, m.lot_no, m.product_code ?? '', m.shelf_code]
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(term)
    })
    if (active === 'kritik') list = list.filter((m) => m.is_critical)
    else if (active === 'bitti') list = list.filter((m) => m.is_empty)
    else if (['depoda', 'kullanimda'].includes(active)) list = list.filter((m) => m.status === active && !m.is_empty)
    else if (active !== 'all') list = list.filter((m) => m.test_result === active)

    return [...list].sort((a, b) => {
      const av = a[sort.key] as any
      const bv = b[sort.key] as any
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * sort.dir
    })
  }, [rows, q, active, sort])

  const th = (key: SortKey, label: string) => (
    <th
      className="sortable"
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }))}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hammadde deposu</h1>
          <p>{filtered.length} kayit listeleniyor. Satira tiklayarak numune detayina gidebilirsiniz.</p>
        </div>
        <div className="btn-row no-print">
          <button
            onClick={() =>
              exportCsv(
                'hammadde-listesi',
                filtered.map((m) => ({
                  'Numune No': m.sample_no,
                  Hammadde: m.name,
                  Firma: m.supplier,
                  'Urun Kodu': m.product_code ?? '',
                  'Lot No': m.lot_no,
                  'Gelis Tarihi': m.arrival_date,
                  'Mevcut Stok': m.current_stock,
                  Birim: m.unit,
                  'Raf Yeri': m.shelf_code,
                  Durum: STATUS_LABEL[m.status],
                  'Test Sonucu': RESULT_LABEL[m.test_result],
                })),
              )
            }
          >
            CSV indir
          </button>
          <Link className="btn" to="/etiketler">🏷️ Etiket yazdir</Link>
          {isAdmin && <Link className="btn btn-accent" to="/hammadde-girisi">➕ Hammadde girisi</Link>}
        </div>
      </div>

      <div className="card mb">
        <div className="card-b">
          <div className="filters">
            <div className="field search-wide">
              <label>Ara</label>
              <input
                placeholder="Hammadde, firma, numune no, lot no, urun kodu veya raf kodu"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Filtre</label>
              <select value={active} onChange={(e) => setFilter(e.target.value)}>
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th('sample_no', 'Numune no')}
                {th('name', 'Hammadde')}
                {th('supplier', 'Firma')}
                {th('product_code', 'Urun kodu')}
                {th('lot_no', 'Lot no')}
                {th('arrival_date', 'Gelis')}
                {th('current_stock', 'Mevcut stok')}
                {th('shelf_code', 'Raf yeri')}
                {th('status', 'Durum')}
                {th('test_result', 'Test sonucu')}
                {th('last_used_at', 'Son kullanim')}
                <th className="no-print">Islem</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="empty">Yukleniyor…</td></tr>}
              {!loading && !filtered.length && (
                <tr><td colSpan={12} className="empty"><strong>Kayit bulunamadi</strong>Arama veya filtreyi degistirin.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/hammadde/${m.id}`)}>
                  <td className="mono">{m.sample_no}</td>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.supplier}</td>
                  <td>{m.product_code ?? '-'}</td>
                  <td className="mono">{m.lot_no}</td>
                  <td>{dt(m.arrival_date, false)}</td>
                  <td>
                    {qty(m.current_stock, m.unit)}{' '}
                    <StockBadge stock={m.current_stock} min={m.min_stock} unit={m.unit} />
                  </td>
                  <td><span className="chip">{m.shelf_code}</span></td>
                  <td><StatusBadge value={m.status} /></td>
                  <td><ResultBadge value={m.test_result} /></td>
                  <td>{m.last_used_at ? dt(m.last_used_at, false) : '-'}</td>
                  <td className="no-print"><Link className="btn btn-sm" to={`/hammadde/${m.id}`} onClick={(e) => e.stopPropagation()}>Ac</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
