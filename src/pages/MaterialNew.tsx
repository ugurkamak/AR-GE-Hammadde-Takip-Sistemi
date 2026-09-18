import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { shelfCode, todayISO } from '../lib/helpers'
import { UNITS } from '../lib/constants'
import FileUpload from '../components/FileUpload'
import QrImage from '../components/QrImage'
import type { Material, WarehouseSection } from '../lib/types'

const empty = {
  name: '', supplier: '', product_code: '', lot_no: '', arrival_date: todayISO(),
  initial_quantity: '', unit: 'kg', package_info: '', min_stock: '',
  section: '', shelf_no: '', level_no: '', bin_no: '',
  material_type: '', pigment_type: '', color: '', technical_spec: '', usage_purpose: '', description: '',
}

export default function MaterialNew() {
  const nav = useNavigate()
  const [form, setForm] = useState({ ...empty })
  const [sections, setSections] = useState<WarehouseSection[]>([])
  const [dupe, setDupe] = useState<{ sample_no: string; name: string; arrival_date: string }[]>([])
  const [dupeAccepted, setDupeAccepted] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Material | null>(null)

  useEffect(() => {
    supabase.from('warehouse_sections').select('*').order('code').then(({ data }) => {
      const list = (data as WarehouseSection[]) ?? []
      setSections(list)
      setForm((f) => ({ ...f, section: f.section || list[0]?.code || '' }))
    })
  }, [])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const sec = sections.find((s) => s.code === form.section)

  // Ayni firma + ayni lot kontrolu
  useEffect(() => {
    const t = setTimeout(async () => {
      if (form.supplier.trim().length < 2 || form.lot_no.trim().length < 1) return setDupe([])
      const { data } = await supabase.rpc('check_duplicate', {
        p_supplier: form.supplier.trim(),
        p_lot: form.lot_no.trim(),
      })
      setDupe((data as any[]) ?? [])
      setDupeAccepted(false)
    }, 400)
    return () => clearTimeout(t)
  }, [form.supplier, form.lot_no])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dupe.length && !dupeAccepted) {
      setErr('Ayni firma ve lot numarasi ile kayit var. Devam etmek icin onay kutusunu isaretleyin.')
      return
    }
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.rpc('create_material', { p: { ...form } })
    setBusy(false)
    if (error) return setErr(error.message)
    setCreated(data as Material)
  }

  if (created)
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{created.name} kaydedildi</h1>
            <p>Numune numarasi olustu ve ilk stok girisi islendi. Etiketi yazdirip kabi isaretleyin.</p>
          </div>
        </div>
        <div className="grid col-2">
          <div className="card">
            <div className="card-b">
              <dl className="kv">
                <dt>Numune no</dt><dd className="mono"><strong>{created.sample_no}</strong></dd>
                <dt>Lot no</dt><dd className="mono">{created.lot_no}</dd>
                <dt>Raf yeri</dt><dd><span className="chip">{created.shelf_code}</span></dd>
                <dt>Giren miktar</dt><dd>{created.initial_quantity} {created.unit}</dd>
              </dl>
              <div className="btn-row mt">
                <button className="btn-primary" onClick={() => nav(`/hammadde/${created.id}`)}>Numuneyi ac</button>
                <button onClick={() => nav('/etiketler?numune=' + created.sample_no)}>Etiketi yazdir</button>
                <button onClick={() => { setCreated(null); setForm({ ...empty, section: form.section }) }}>Yeni kayit</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h2>QR kod</h2></div>
            <div className="card-b qr-box">
              <QrImage sampleNo={created.sample_no} size={170} />
              <span className="small muted">QR icinde yalnizca numune numarasi bulunur.</span>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h2>Dosya ekle</h2></div>
            <div className="card-b">
              <FileUpload materialId={created.id} />
              <p className="small muted mt">TDS, SDS, COA, teknik dokuman veya fotograf ekleyebilirsiniz.</p>
            </div>
          </div>
        </div>
      </>
    )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hammadde girisi</h1>
          <p>Firmadan gelen numuneyi kaydedin. Numune numarasi ve QR kod otomatik olusur.</p>
        </div>
      </div>

      <form onSubmit={submit} style={{ maxWidth: 940 }}>
        {err && <div className="alert alert-err">{err}</div>}
        {dupe.length > 0 && (
          <div className="alert alert-warn">
            <strong>Bu lot daha once kaydedilmis.</strong>{' '}
            {dupe.map((d) => `${d.sample_no} (${d.name}, ${d.arrival_date})`).join(', ')}
            <label className="checkline mt">
              <input type="checkbox" checked={dupeAccepted} onChange={(e) => setDupeAccepted(e.target.checked)} />
              Yine de yeni kayit olustur
            </label>
          </div>
        )}

        <div className="card mb">
          <div className="card-h"><h2>Temel bilgiler</h2></div>
          <div className="card-b form-grid">
            <div className="field"><label>Hammadde adi <span className="req">*</span></label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Organish Gelb" /></div>
            <div className="field"><label>Firma / tedarikci <span className="req">*</span></label>
              <input required value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="XYZ Kimya" /></div>
            <div className="field"><label>Urun kodu</label>
              <input value={form.product_code} onChange={(e) => set('product_code', e.target.value)} /></div>
            <div className="field"><label>Lot no <span className="req">*</span></label>
              <input required value={form.lot_no} onChange={(e) => set('lot_no', e.target.value)} placeholder="24581" /></div>
            <div className="field"><label>Gelis tarihi <span className="req">*</span></label>
              <input type="date" required value={form.arrival_date} onChange={(e) => set('arrival_date', e.target.value)} /></div>
            <div className="field"><label>Gelen miktar <span className="req">*</span></label>
              <input type="number" step="0.001" min="0" required value={form.initial_quantity} onChange={(e) => set('initial_quantity', e.target.value)} /></div>
            <div className="field"><label>Birim <span className="req">*</span></label>
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label>Ambalaj bilgisi</label>
              <input value={form.package_info} onChange={(e) => set('package_info', e.target.value)} placeholder="5 kg teneke" /></div>
            <div className="field"><label>Minimum stok seviyesi</label>
              <input type="number" step="0.001" min="0" value={form.min_stock} onChange={(e) => set('min_stock', e.target.value)} /></div>
          </div>
        </div>

        <div className="card mb">
          <div className="card-h">
            <h2>Depo konumu</h2>
            <span className="chip">{form.shelf_no ? shelfCode(form.section, form.shelf_no, form.level_no, form.bin_no) : 'Raf kodu'}</span>
          </div>
          <div className="card-b form-grid">
            <div className="field"><label>Depo bolumu <span className="req">*</span></label>
              <select required value={form.section} onChange={(e) => set('section', e.target.value)}>
                {sections.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select></div>
            <div className="field"><label>Raf no <span className="req">*</span></label>
              <input type="number" min="1" max={sec?.shelf_count ?? 99} required value={form.shelf_no} onChange={(e) => set('shelf_no', e.target.value)} /></div>
            <div className="field"><label>Kat no</label>
              <input type="number" min="1" max={sec?.level_count ?? 99} value={form.level_no} onChange={(e) => set('level_no', e.target.value)} /></div>
            <div className="field"><label>Goz no</label>
              <input type="number" min="1" max={sec?.bin_count ?? 99} value={form.bin_no} onChange={(e) => set('bin_no', e.target.value)} /></div>
          </div>
        </div>

        <div className="card mb">
          <div className="card-h"><h2>Teknik bilgiler</h2></div>
          <div className="card-b form-grid">
            <div className="field"><label>Hammadde tipi</label>
              <input value={form.material_type} onChange={(e) => set('material_type', e.target.value)} placeholder="Pigment / recine / katki" /></div>
            <div className="field"><label>Pigment tipi</label>
              <input value={form.pigment_type} onChange={(e) => set('pigment_type', e.target.value)} placeholder="Organik / inorganik" /></div>
            <div className="field"><label>Renk</label>
              <input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Sari" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Teknik ozellik</label>
              <textarea value={form.technical_spec} onChange={(e) => set('technical_spec', e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Kullanim amaci</label>
              <input value={form.usage_purpose} onChange={(e) => set('usage_purpose', e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Aciklama</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn-accent" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Hammaddeyi kaydet'}</button>
          <button type="button" onClick={() => nav('/hammaddeler')}>Vazgec</button>
        </div>
        <p className="small muted mt">Kayit tamamlandiktan sonra dosya yukleme ve etiket yazdirma adimi acilir.</p>
      </form>
    </>
  )
}
