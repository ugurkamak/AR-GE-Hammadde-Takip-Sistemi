import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { qty, shelfCode } from '../lib/helpers'
import type { Material, WarehouseSection } from '../lib/types'

export default function Warehouse() {
  const [sections, setSections] = useState<WarehouseSection[]>([])
  const [rows, setRows] = useState<Material[]>([])
  const [active, setActive] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('warehouse_sections').select('*').order('code').then(({ data }) => {
      const list = (data as WarehouseSection[]) ?? []
      setSections(list)
      setActive((a) => a || list[0]?.code || '')
    })
    supabase.from('materials_view').select('*').then(({ data }) => setRows((data as Material[]) ?? []))
  }, [])

  const sec = sections.find((s) => s.code === active)

  const byBin = useMemo(() => {
    const map: Record<string, Material[]> = {}
    rows.filter((m) => !m.is_empty).forEach((m) => {
      ;(map[m.shelf_code] ??= []).push(m)
    })
    return map
  }, [rows])

  const selected = sel ? byBin[sel] ?? [] : []

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Depo / raflar</h1>
          <p>Raf kodu bolum-raf-kat-goz sirasiyla okunur. Ornek: A-03-02-04 = A bolumu, 3. raf, 2. kat, 4. goz.</p>
        </div>
      </div>

      <div className="row mb">
        {sections.map((s) => (
          <button key={s.code} className={s.code === active ? 'btn-primary' : ''} onClick={() => { setActive(s.code); setSel(null) }}>
            {s.code} · {s.name}
          </button>
        ))}
      </div>

      <div className="grid col-2">
        <div className="card">
          <div className="card-h"><h2>{sec?.name ?? 'Bolum'}</h2><span className="small muted">Dolu gozler sari</span></div>
          <div className="card-b rack">
            {sec && Array.from({ length: sec.shelf_count }, (_, i) => i + 1).map((shelf) => (
              <div className="rack-row" key={shelf}>
                <h4>Raf {String(shelf).padStart(2, '0')}</h4>
                <div className="levels">
                  {Array.from({ length: sec.level_count }, (_, i) => i + 1).map((level) => (
                    <div className="level-row" key={level}>
                      <span className="level-label">Kat {level}</span>
                      <div className="bins">
                        {Array.from({ length: sec.bin_count }, (_, i) => i + 1).map((bin) => {
                          const code = shelfCode(sec.code, shelf, level, bin)
                          const items = byBin[code] ?? []
                          return (
                            <button
                              key={bin}
                              className={`bin ${items.length ? 'full' : ''} ${sel === code ? 'sel' : ''}`}
                              onClick={() => setSel(code)}
                              title={items.map((i) => i.name).join(', ') || 'Bos'}
                            >
                              {String(bin).padStart(2, '0')}
                              {items.length > 0 && <div style={{ fontSize: 9 }}>{items.length}</div>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card-h"><h2>{sel ?? 'Bir goz secin'}</h2></div>
          <div className="card-b">
            {!sel && <p className="muted">Soldaki raf planindan bir goz secerek icindeki numuneleri gorebilirsiniz.</p>}
            {sel && !selected.length && <p className="muted">Bu goz bos.</p>}
            {selected.map((m) => (
              <div key={m.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                <Link to={`/hammadde/${m.id}`}><strong>{m.name}</strong></Link>
                <div className="small muted">
                  <span className="mono">{m.sample_no}</span> · Lot {m.lot_no} · {m.supplier}
                </div>
                <div className="small">{qty(m.current_stock, m.unit)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
