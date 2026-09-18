import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QrImage from '../components/QrImage'
import type { Material } from '../lib/types'

export default function Labels() {
  const [params] = useSearchParams()
  const [rows, setRows] = useState<Material[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [perPage, setPerPage] = useState<12 | 24>(12)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('materials_view').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      const list = (data as Material[]) ?? []
      setRows(list)
      const pre = params.get('numune')
      if (pre) {
        const hit = list.find((m) => m.sample_no === pre)
        if (hit) setSelected([hit.id])
      }
    })
  }, [params])

  const term = q.trim().toLocaleLowerCase('tr')
  const filtered = useMemo(
    () => rows.filter((m) => !term || `${m.name} ${m.sample_no} ${m.lot_no} ${m.supplier} ${m.shelf_code}`.toLocaleLowerCase('tr').includes(term)),
    [rows, term],
  )
  const chosen = rows.filter((m) => selected.includes(m.id))
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>QR etiketleri</h1>
          <p>Etiketleri secin, A4 sayfaya {perPage} adet gelecek sekilde yazdirin. Etiket istediginiz zaman yeniden basilabilir.</p>
        </div>
        <div className="btn-row">
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value) as 12 | 24)} style={{ width: 'auto' }}>
            <option value={12}>A4 sayfada 12 etiket</option>
            <option value={24}>A4 sayfada 24 etiket</option>
          </select>
          <button className="btn-accent" onClick={() => window.print()} disabled={!chosen.length}>Yazdir</button>
        </div>
      </div>

      <div className="card mb no-print">
        <div className="card-b">
          <div className="row mb">
            <div className="field search-wide" style={{ margin: 0 }}>
              <label>Ara</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hammadde, numune, lot veya raf" />
            </div>
            <button onClick={() => setSelected(filtered.map((m) => m.id))}>Listedekileri sec</button>
            <button onClick={() => setSelected([])}>Secimi temizle</button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead><tr><th></th><th>Numune</th><th>Hammadde</th><th>Lot</th><th>Raf</th></tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => toggle(m.id)} style={{ cursor: 'pointer' }}>
                    <td><input type="checkbox" readOnly checked={selected.includes(m.id)} style={{ width: 16 }} /></td>
                    <td className="mono">{m.sample_no}</td>
                    <td>{m.name}</td>
                    <td className="mono">{m.lot_no}</td>
                    <td><span className="chip">{m.shelf_code}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted mt">{selected.length} etiket secildi.</p>
        </div>
      </div>

      <div className={`labels per${perPage}`}>
        {chosen.map((m) => (
          <div className="label" key={m.id}>
            <QrImage sampleNo={m.sample_no} size={perPage === 12 ? 62 : 48} />
            <div className="meta">
              <div className="hdr">AR-GE HAMMADDE</div>
              <div className="nm">{m.name}</div>
              <div><span className="hdr">Numune</span> <span className="mono">{m.sample_no}</span></div>
              <div><span className="hdr">Lot</span> <span className="mono">{m.lot_no}</span></div>
              <div><span className="hdr">Raf</span> <span className="mono">{m.shelf_code}</span></div>
            </div>
          </div>
        ))}
      </div>
      {!chosen.length && <div className="card no-print"><div className="empty"><strong>Etiket secilmedi</strong>Yukaridaki listeden numune secin.</div></div>}
    </>
  )
}
