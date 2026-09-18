import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dt, qty } from '../lib/helpers'
import { MOVEMENT_LABEL, NOT_USED_REASONS, RESULT_LABEL, UNITS } from '../lib/constants'
import { ResultBadge, StatusBadge, StockBadge } from '../components/Badges'
import Modal from '../components/Modal'
import QrImage from '../components/QrImage'
import FileUpload from '../components/FileUpload'
import type { ActivityLog, Attachment, Material, StockMovement, TestRecord, TestResult, Usage, WarehouseSection } from '../lib/types'

type Tab = 'genel' | 'stok' | 'kullanim' | 'test' | 'dosya' | 'gecmis' | 'qr'
type Dialog = null | 'kullan' | 'kullanmadim' | 'test' | 'duzelt' | 'tasi'

export default function MaterialDetail({ bySampleNo }: { bySampleNo?: boolean }) {
  const { id, sampleNo } = useParams()
  const nav = useNavigate()
  const { isAdmin, profile } = useAuth()

  const [m, setM] = useState<Material | null>(null)
  const [tab, setTab] = useState<Tab>('genel')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [moves, setMoves] = useState<StockMovement[]>([])
  const [usages, setUsages] = useState<Usage[]>([])
  const [tests, setTests] = useState<TestRecord[]>([])
  const [files, setFiles] = useState<Attachment[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [sections, setSections] = useState<WarehouseSection[]>([])
  const [notFound, setNotFound] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const q = supabase.from('materials_view').select('*')
    const { data } = bySampleNo ? await q.eq('sample_no', sampleNo).maybeSingle() : await q.eq('id', id).maybeSingle()
    if (!data) return setNotFound(true)
    const mat = data as Material
    setM(mat)
    const [mv, us, ts, fl, lg, sc] = await Promise.all([
      supabase.from('stock_movements').select('*, profiles(full_name)').eq('material_id', mat.id).order('created_at', { ascending: false }),
      supabase.from('usages').select('*, profiles(full_name)').eq('material_id', mat.id).order('created_at', { ascending: false }),
      supabase.from('test_results').select('*, profiles(full_name)').eq('material_id', mat.id).order('created_at', { ascending: false }),
      supabase.from('attachments').select('*').eq('material_id', mat.id).order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').eq('sample_no', mat.sample_no).order('created_at', { ascending: false }).limit(50),
      supabase.from('warehouse_sections').select('*').order('code'),
    ])
    setMoves((mv.data as StockMovement[]) ?? [])
    setUsages((us.data as Usage[]) ?? [])
    setTests((ts.data as TestRecord[]) ?? [])
    setFiles((fl.data as Attachment[]) ?? [])
    setLogs((lg.data as ActivityLog[]) ?? [])
    setSections((sc.data as WarehouseSection[]) ?? [])
  }, [id, sampleNo, bySampleNo])

  useEffect(() => { load() }, [load])

  const openFile = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from('material-files').createSignedUrl(a.storage_path, 120)
    if (error) return setErr('Dosya acilamadi: ' + error.message)
    window.open(data.signedUrl, '_blank')
  }

  if (notFound)
    return (
      <div className="card">
        <div className="card-b">
          <h2>Numune bulunamadi</h2>
          <p className="muted">{sampleNo ?? id} numarali kayit sistemde yok. QR etiketi eski bir kayda ait olabilir.</p>
          <Link className="btn mt" to="/hammaddeler">Hammadde listesine don</Link>
        </div>
      </div>
    )
  if (!m) return <div className="spinner">Yukleniyor…</div>

  const done = (text: string) => { setDialog(null); setMsg(text); setErr(''); load(); setTimeout(() => setMsg(''), 4000) }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{m.name}</h1>
          <p>
            <span className="mono">{m.sample_no}</span> · {m.supplier} · Lot <span className="mono">{m.lot_no}</span> ·{' '}
            <span className="chip">{m.shelf_code}</span>
          </p>
          <div className="row mt">
            <StatusBadge value={m.status} />
            <ResultBadge value={m.test_result} />
            <StockBadge stock={m.current_stock} min={m.min_stock} unit={m.unit} />
          </div>
        </div>
        <div className="card" style={{ minWidth: 180 }}>
          <div className="card-b">
            <div className="small muted">Mevcut stok</div>
            <div className="stock-hero"><span className="v">{qty(m.current_stock)}</span><span>{m.unit}</span></div>
            <div className="small muted">Gelen: {qty(m.initial_quantity, m.unit)} · Min: {qty(m.min_stock, m.unit)}</div>
          </div>
        </div>
      </div>

      {msg && <div className="alert alert-ok">{msg}</div>}
      {err && <div className="alert alert-err">{err}</div>}

      <div className="btn-row mb no-print">
        <button className="btn-accent" onClick={() => setDialog('kullan')} disabled={m.current_stock <= 0}>🧪 Kullan</button>
        <button onClick={() => setDialog('kullanmadim')}>⚪ Kullanmadim</button>
        <button onClick={() => setDialog('test')}>📝 Test sonucu gir</button>
        <button onClick={() => setTab('stok')}>📊 Stok hareketleri</button>
        <button onClick={() => setTab('gecmis')}>📜 Gecmis</button>
        {isAdmin && <button onClick={() => setDialog('duzelt')}>Stok duzelt</button>}
        {isAdmin && <button onClick={() => setDialog('tasi')}>Raf degistir</button>}
      </div>

      <div className="card">
        <div className="tabs no-print">
          {([
            ['genel', 'Genel bilgiler'], ['stok', `Stok (${moves.length})`], ['kullanim', `Kullanimlar (${usages.length})`],
            ['test', `Test sonuclari (${tests.length})`], ['dosya', `Dosyalar (${files.length})`], ['gecmis', 'Gecmis'], ['qr', 'QR'],
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        <div className="card-b">
          {tab === 'genel' && (
            <dl className="kv">
              <dt>Numune no</dt><dd className="mono">{m.sample_no}</dd>
              <dt>Hammadde</dt><dd>{m.name}</dd>
              <dt>Firma</dt><dd>{m.supplier}</dd>
              <dt>Urun kodu</dt><dd>{m.product_code ?? '-'}</dd>
              <dt>Lot no</dt><dd className="mono">{m.lot_no}</dd>
              <dt>Gelis tarihi</dt><dd>{dt(m.arrival_date, false)}</dd>
              <dt>Ambalaj</dt><dd>{m.package_info ?? '-'}</dd>
              <dt>Raf yeri</dt><dd><span className="chip">{m.shelf_code}</span></dd>
              <dt>Hammadde tipi</dt><dd>{m.material_type ?? '-'}</dd>
              <dt>Pigment tipi</dt><dd>{m.pigment_type ?? '-'}</dd>
              <dt>Renk</dt><dd>{m.color ?? '-'}</dd>
              <dt>Teknik ozellik</dt><dd>{m.technical_spec ?? '-'}</dd>
              <dt>Kullanim amaci</dt><dd>{m.usage_purpose ?? '-'}</dd>
              <dt>Aciklama</dt><dd>{m.description ?? '-'}</dd>
              <dt>Kaydeden</dt><dd>{m.created_by_name ?? '-'} · {dt(m.created_at)}</dd>
            </dl>
          )}

          {tab === 'stok' && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tarih</th><th>Hareket</th><th>Miktar</th><th>Kullanici</th><th className="wrap">Aciklama</th></tr></thead>
                <tbody>
                  {moves.map((s) => (
                    <tr key={s.id}>
                      <td>{dt(s.created_at)}</td>
                      <td>{MOVEMENT_LABEL[s.type]}</td>
                      <td style={{ color: s.quantity < 0 ? 'var(--red)' : s.quantity > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 600 }}>
                        {s.quantity > 0 ? '+' : ''}{qty(s.quantity, s.unit)}
                      </td>
                      <td>{s.profiles?.full_name ?? '-'}</td>
                      <td className="wrap">{s.note ?? '-'}</td>
                    </tr>
                  ))}
                  {!moves.length && <tr><td colSpan={5} className="empty">Hareket yok.</td></tr>}
                </tbody>
              </table>
              <p className="small muted mt">Mevcut stok bu hareketlerin toplamidir: <strong>{qty(m.current_stock, m.unit)}</strong></p>
            </div>
          )}

          {tab === 'kullanim' && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tarih</th><th>Kullanici</th><th>Durum</th><th>Miktar</th><th>Proje / deneme</th><th className="wrap">Aciklama</th></tr></thead>
                <tbody>
                  {usages.map((u) => (
                    <tr key={u.id}>
                      <td>{dt(u.created_at)}</td>
                      <td>{u.profiles?.full_name ?? '-'}</td>
                      <td>{u.is_used ? 'Kullanildi' : `Kullanilmadi · ${NOT_USED_REASONS[u.not_used_reason ?? 'diger']}`}</td>
                      <td>{u.is_used ? qty(u.quantity, u.unit) : u.returned ? `${qty(u.quantity, u.unit)} iade` : '-'}</td>
                      <td>{[u.project, u.trial_no].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="wrap">{u.note ?? u.purpose ?? '-'}</td>
                    </tr>
                  ))}
                  {!usages.length && <tr><td colSpan={6} className="empty">Kullanim kaydi yok.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'test' && (
            <>
              <div className="btn-row mb no-print"><button className="btn-sm" onClick={() => setDialog('test')}>Yeni test sonucu</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Tarih</th><th>Test</th><th>Sonuc</th><th>Giren</th><th className="wrap">Aciklama</th></tr></thead>
                  <tbody>
                    {tests.map((t) => (
                      <tr key={t.id}>
                        <td>{dt(t.tested_at, false)}</td>
                        <td>{t.title ?? '-'}</td>
                        <td><ResultBadge value={t.result} /></td>
                        <td>{t.profiles?.full_name ?? '-'}</td>
                        <td className="wrap">{t.description ?? '-'}</td>
                      </tr>
                    ))}
                    {!tests.length && <tr><td colSpan={5} className="empty">Henuz test sonucu girilmemis.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'dosya' && (
            <>
              <FileUpload materialId={m.id} onUploaded={load} />
              <div className="table-wrap mt">
                <table>
                  <thead><tr><th>Dosya</th><th>Tur</th><th>Tarih</th><th></th></tr></thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td>{f.file_name}</td>
                        <td>{f.category}</td>
                        <td>{dt(f.created_at)}</td>
                        <td className="right"><button className="btn-sm" onClick={() => openFile(f)}>Ac</button></td>
                      </tr>
                    ))}
                    {!files.length && <tr><td colSpan={4} className="empty"><strong>Dosya yok</strong>TDS, SDS, COA veya test raporu ekleyin.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'gecmis' && (
            <ul className="timeline">
              {logs.map((l) => (
                <li key={l.id}>
                  <div className="t">{dt(l.created_at)} · {l.user_name ?? '-'}</div>
                  <div>{l.action}</div>
                  {l.detail && <div className="small muted">{l.detail}</div>}
                </li>
              ))}
              {!logs.length && <li className="muted">Kayit yok.</li>}
            </ul>
          )}

          {tab === 'qr' && (
            <div className="qr-box">
              <QrImage sampleNo={m.sample_no} size={200} />
              <div className="mono">{m.sample_no}</div>
              <p className="small muted" style={{ maxWidth: '46ch', textAlign: 'center' }}>
                QR icinde hammadde adi yoktur, yalnizca numune numarasina giden adres bulunur. Raf degisse de QR ayni kalir.
              </p>
              <Link className="btn" to={`/etiketler?numune=${m.sample_no}`}>Etiketi yazdir</Link>
            </div>
          )}
        </div>
      </div>

      {dialog === 'kullan' && <UseDialog m={m} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'kullanmadim' && <NotUsedDialog m={m} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'test' && <TestDialog m={m} testCount={tests.length} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'duzelt' && <AdjustDialog m={m} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'tasi' && <MoveDialog m={m} sections={sections} onClose={() => setDialog(null)} onDone={done} />}
    </>
  )
}

/* ---------------- Kullan ---------------- */
function UseDialog({ m, onClose, onDone }: { m: Material; onClose: () => void; onDone: (s: string) => void }) {
  const [f, setF] = useState({ quantity: '', purpose: '', project: '', trial_no: '', note: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const kalan = m.current_stock - Number(f.quantity || 0)

  const save = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('record_usage', {
      p_material_id: m.id, p_quantity: Number(f.quantity),
      p_purpose: f.purpose || null, p_project: f.project || null,
      p_trial_no: f.trial_no || null, p_note: f.note || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(`${qty(Number(f.quantity), m.unit)} kullanim kaydedildi.`)
  }

  return (
    <Modal title="Kullanim kaydi" onClose={onClose}
      footer={<><button onClick={onClose}>Vazgec</button><button className="btn-accent" disabled={busy || !f.quantity} onClick={save}>{busy ? 'Kaydediliyor…' : 'Kullanimi kaydet'}</button></>}>
      {err && <div className="alert alert-err">{err}</div>}
      <p className="small muted">Kullanici, tarih ve saat otomatik kaydedilir.</p>
      <div className="field">
        <label>Kullanilan miktar ({m.unit}) <span className="req">*</span></label>
        <input type="number" step="0.001" min="0" max={m.current_stock} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} autoFocus />
        <p className="small muted" style={{ marginTop: 6 }}>
          Mevcut {qty(m.current_stock, m.unit)} · Kayittan sonra{' '}
          <strong style={{ color: kalan < 0 ? 'var(--red)' : undefined }}>{qty(Math.max(kalan, 0), m.unit)}</strong>
        </p>
      </div>
      <div className="form-grid">
        <div className="field"><label>Kullanim amaci</label><input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></div>
        <div className="field"><label>Proje / urun</label><input value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} /></div>
        <div className="field"><label>Deneme numarasi</label><input value={f.trial_no} onChange={(e) => setF({ ...f, trial_no: e.target.value })} /></div>
      </div>
      <div className="field"><label>Aciklama</label><textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
    </Modal>
  )
}

/* ---------------- Kullanmadim ---------------- */
function NotUsedDialog({ m, onClose, onDone }: { m: Material; onClose: () => void; onDone: (s: string) => void }) {
  const [reason, setReason] = useState('uygun_degil')
  const [note, setNote] = useState('')
  const [returned, setReturned] = useState(false)
  const [rq, setRq] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('record_not_used', {
      p_material_id: m.id, p_reason: reason, p_note: note || null,
      p_returned: returned, p_return_qty: returned ? Number(rq || 0) : 0,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone('Kullanilmadi kaydi olusturuldu.')
  }

  return (
    <Modal title="Kullanilmadi" onClose={onClose}
      footer={<><button onClick={onClose}>Vazgec</button><button className="btn-primary" disabled={busy} onClick={save}>Kaydet</button></>}>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="field">
        <label>Neden</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(NOT_USED_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="field"><label>Aciklama</label><textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <label className="checkline"><input type="checkbox" checked={returned} onChange={(e) => setReturned(e.target.checked)} /> Numune fiziksel olarak depoya geri kondu</label>
      {returned && (
        <div className="field mt"><label>Iade edilen miktar ({m.unit})</label>
          <input type="number" step="0.001" min="0" value={rq} onChange={(e) => setRq(e.target.value)} />
          <p className="small muted" style={{ marginTop: 6 }}>Iade miktari stok hareketi olarak eklenir.</p>
        </div>
      )}
    </Modal>
  )
}

/* ---------------- Test sonucu ---------------- */
function TestDialog({ m, testCount, onClose, onDone }: { m: Material; testCount: number; onClose: () => void; onDone: (s: string) => void }) {
  const { session } = useAuth()
  const [title, setTitle] = useState(`${testCount + 1}. Test`)
  const [result, setResult] = useState<TestResult>('olumlu')
  const [description, setDescription] = useState('')
  const [required, setRequired] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'require_test_description').maybeSingle()
      .then(({ data }) => setRequired(data?.value === true))
  }, [])

  const save = async () => {
    if (required && !description.trim()) return setErr('Sonuc aciklamasi zorunlu. Ayarlardan degistirilebilir.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('test_results')
      .insert({ material_id: m.id, title, result, description: description || null, created_by: session!.user.id })
      .select().single()
    if (!error && data) {
      await supabase.rpc('log_activity', {
        p_action: 'Test sonucu girildi', p_detail: `${title}: ${RESULT_LABEL[result]}`,
        p_entity_type: 'test', p_entity_id: data.id, p_sample_no: m.sample_no,
      })
    }
    setBusy(false)
    if (error) return setErr(error.message)
    onDone('Test sonucu kaydedildi.')
  }

  return (
    <Modal title="Test sonucu gir" onClose={onClose}
      footer={<><button onClick={onClose}>Vazgec</button><button className="btn-primary" disabled={busy} onClick={save}>Sonucu kaydet</button></>}>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="form-grid">
        <div className="field"><label>Test adi</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="1. Test / Revizyon / Stabilite" /></div>
        <div className="field"><label>Sonuc</label>
          <select value={result} onChange={(e) => setResult(e.target.value as TestResult)}>
            {(Object.keys(RESULT_LABEL) as TestResult[]).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Sonuc aciklamasi {required && <span className="req">*</span>}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Renk kuvveti referansa gore uygun. Dispersiyon problemi gozlenmedi." />
      </div>
      <p className="small muted">Kaydettikten sonra Dosyalar sekmesinden test raporu veya fotograf ekleyebilirsiniz. Onceki sonuclar silinmez, yeni sonuc gecmise eklenir.</p>
    </Modal>
  )
}

/* ---------------- Stok duzeltme ---------------- */
function AdjustDialog({ m, onClose, onDone }: { m: Material; onClose: () => void; onDone: (s: string) => void }) {
  const [type, setType] = useState('duzeltme')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setErr('')
    const signed = type === 'iade' ? Math.abs(Number(amount)) : type === 'fire' ? -Math.abs(Number(amount)) : Number(amount)
    const { error } = await supabase.rpc('adjust_stock', {
      p_material_id: m.id, p_type: type, p_quantity: type === 'bitis' ? 0 : signed, p_note: note || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone('Stok hareketi kaydedildi.')
  }

  return (
    <Modal title="Stok duzeltme" onClose={onClose}
      footer={<><button onClick={onClose}>Vazgec</button><button className="btn-primary" disabled={busy} onClick={save}>Hareketi kaydet</button></>}>
      {err && <div className="alert alert-err">{err}</div>}
      <p className="small muted">Stok dogrudan degistirilemez; her degisiklik bir hareket olarak kaydedilir.</p>
      <div className="form-grid">
        <div className="field"><label>Hareket tipi</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="duzeltme">Duzeltme (+/-)</option>
            <option value="iade">Iade (+)</option>
            <option value="fire">Fire (-)</option>
            <option value="bitis">Bitis (stogu sifirla)</option>
          </select>
        </div>
        {type !== 'bitis' && (
          <div className="field"><label>Miktar ({m.unit})</label>
            <input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={type === 'duzeltme' ? '-0,5 veya 1,25' : '0,5'} />
          </div>
        )}
      </div>
      <div className="field"><label>Aciklama</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  )
}

/* ---------------- Raf degistir ---------------- */
function MoveDialog({ m, sections, onClose, onDone }: { m: Material; sections: WarehouseSection[]; onClose: () => void; onDone: (s: string) => void }) {
  const [f, setF] = useState({ section: m.section, shelf: String(m.shelf_no), level: String(m.level_no ?? ''), bin: String(m.bin_no ?? ''), note: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('move_material', {
      p_material_id: m.id, p_section: f.section, p_shelf: Number(f.shelf),
      p_level: f.level ? Number(f.level) : null, p_bin: f.bin ? Number(f.bin) : null, p_note: f.note || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone('Depo konumu guncellendi. QR kod degismedi.')
  }

  return (
    <Modal title="Depo konumunu degistir" onClose={onClose}
      footer={<><button onClick={onClose}>Vazgec</button><button className="btn-primary" disabled={busy} onClick={save}>Konumu guncelle</button></>}>
      {err && <div className="alert alert-err">{err}</div>}
      <p className="small muted">Mevcut konum: <span className="chip">{m.shelf_code}</span></p>
      <div className="form-grid">
        <div className="field"><label>Bolum</label>
          <select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
            {sections.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
          </select></div>
        <div className="field"><label>Raf</label><input type="number" min="1" value={f.shelf} onChange={(e) => setF({ ...f, shelf: e.target.value })} /></div>
        <div className="field"><label>Kat</label><input type="number" min="1" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} /></div>
        <div className="field"><label>Goz</label><input type="number" min="1" value={f.bin} onChange={(e) => setF({ ...f, bin: e.target.value })} /></div>
      </div>
      <div className="field"><label>Aciklama</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
      <p className="small muted">QR kod ayni kalir; etiketi yeniden yazdirmaniz gerekmez.</p>
    </Modal>
  )
}
