import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'tds' | 'sds' | 'comparison'
type DocType = 'tds' | 'sds'
type DocumentRow = {
  id: string
  file_name: string
  document_type: DocType
  storage_path: string
  file_size: number
  created_at: string
}
type Report = {
  id: string
  title: string
  report_type: Mode
  report_json: Record<string, unknown>
  created_at: string
}
type ReportContent = {
  title?: string
  documentType?: string
  executiveSummary?: string
  parameters?: Array<Record<string, string>>
  comparison?: Array<Record<string, string>>
  hazards?: Array<Record<string, string>>
  safetyChecklist?: string[]
  missingInformation?: string[]
  recommendations?: string[]
  sourceNotes?: string[]
}

const labelForType = (type: string) => type === 'tds' ? 'TDS · Teknik veri' : type === 'sds' ? 'SDS · Güvenlik bilgi formu' : 'TDS karşılaştırması'
const prettyDate = (value: string) => new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
const formatBytes = (n: number) => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`

export default function DocumentAnalysis() {
  const [mode, setMode] = useState<Mode>('tds')
  const [firstFile, setFirstFile] = useState<File | null>(null)
  const [secondFile, setSecondFile] = useState<File | null>(null)
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [activeReport, setActiveReport] = useState<ReportContent | null>(null)

  const loadArchive = useCallback(async () => {
    const [{ data: docs }, { data: savedReports }] = await Promise.all([
      supabase.from('tds_sds_documents').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('tds_sds_reports').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setDocuments((docs ?? []) as DocumentRow[])
    setReports((savedReports ?? []) as Report[])
  }, [])

  useEffect(() => { void loadArchive() }, [loadArchive])

  const canAnalyze = useMemo(() => {
    if (busy) return false
    if (mode === 'comparison') return Boolean(firstFile && secondFile)
    return Boolean(firstFile)
  }, [busy, firstFile, secondFile, mode])

  const uploadDocument = async (file: File, type: DocType): Promise<DocumentRow> => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Lütfen PDF dosyası seçin.')
    }
    if (file.size > 15 * 1024 * 1024) throw new Error('Dosya boyutu 15 MB sınırını aşamaz.')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('Oturum süren dolmuş. Yeniden giriş yap.')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const path = `${authData.user.id}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('tds-sds-private').upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (uploadError) throw new Error(`Dosya arşive kaydedilemedi: ${uploadError.message}`)
    const { data, error: insertError } = await supabase.from('tds_sds_documents').insert({
      owner_id: authData.user.id,
      file_name: file.name,
      document_type: type,
      storage_path: path,
      file_size: file.size,
    }).select('*').single()
    if (insertError || !data) {
      await supabase.storage.from('tds-sds-private').remove([path])
      throw new Error(`Belge kaydı oluşturulamadı: ${insertError?.message ?? 'Bilinmeyen hata'}`)
    }
    return data as DocumentRow
  }

  const runAnalysis = async () => {
    if (!canAnalyze) return
    setBusy(true)
    setError('')
    setStatus('Dosyalar özel arşive kaydediliyor…')
    try {
      const firstType: DocType = mode === 'sds' ? 'sds' : 'tds'
      const firstDoc = await uploadDocument(firstFile!, firstType)
      const uploadedDocs = [firstDoc]
      if (mode === 'comparison') {
        setStatus('İkinci TDS arşive kaydediliyor…')
        uploadedDocs.push(await uploadDocument(secondFile!, 'tds'))
      }
      setDocuments((old) => [...uploadedDocs, ...old])
      setStatus('PDF belgeleri güvenli analiz servisine gönderiliyor…')
      const { data, error: functionError } = await supabase.functions.invoke('tds-sds-analyze', {
        body: {
          mode,
          documents: uploadedDocs.map((doc) => ({
            id: doc.id,
            path: doc.storage_path,
            fileName: doc.file_name,
            documentType: doc.document_type,
          })),
        },
      })
      if (functionError) throw new Error(functionError.message || 'Analiz servisine erişilemedi.')
      if (data?.error) throw new Error(data.error)
      if (!data?.report || typeof data.report !== 'object') throw new Error('Analiz sonucu boş geldi.')
      const reportJson = data.report as ReportContent
      setStatus('Rapor arşive kaydediliyor…')
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('Oturum doğrulanamadı.')
      const { data: saved, error: saveError } = await supabase.from('tds_sds_reports').insert({
        owner_id: authData.user.id,
        title: reportJson.title || firstFile!.name,
        report_type: mode,
        document_ids: uploadedDocs.map((doc) => doc.id),
        report_json: reportJson,
        model_name: data.model || 'gpt-4.1-mini',
      }).select('*').single()
      if (saveError || !saved) throw new Error(`Analiz tamamlandı ancak rapor kaydedilemedi: ${saveError?.message ?? 'Bilinmeyen hata'}`)
      setActiveReport(reportJson)
      setReports((old) => [saved as Report, ...old])
      setStatus('Analiz tamamlandı.')
      setFirstFile(null)
      setSecondFile(null)
      setFirstName('')
      setSecondName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata oluştu.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const openSavedReport = (report: Report) => setActiveReport(report.report_json as ReportContent)

  const openDocument = async (doc: DocumentRow) => {
    const { data, error: signedError } = await supabase.storage.from('tds-sds-private').createSignedUrl(doc.storage_path, 60)
    if (signedError || !data?.signedUrl) {
      setError('Belge bağlantısı oluşturulamadı. Erişim iznini kontrol edin.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const exportExcel = async () => {
    if (!activeReport) return
    try {
      const xlsxUrl = 'https://esm.sh/xlsx@0.18.5'
      // @ts-ignore browser ESM module loaded only when user requests an export
      const XLSX = await import(/* @vite-ignore */ xlsxUrl)
      const rows: Record<string, string>[] = []
      for (const p of activeReport.parameters ?? []) rows.push({ Bölüm: 'Teknik parametre', Parametre: p.name ?? '', Değer: p.value ?? '', Birim: p.unit ?? '', 'Test metodu': p.testMethod ?? '', 'Kaynak sayfa': p.sourcePage ?? '', 'Teknik açıklama': p.technicalMeaning ?? '', 'Yorum': p.interpretation ?? '' })
      for (const p of activeReport.comparison ?? []) rows.push({ Bölüm: 'Karşılaştırma', Parametre: p.parameter ?? '', Değer: `A: ${p.documentA ?? ''} | B: ${p.documentB ?? ''}`, Birim: '', 'Test metodu': '', 'Kaynak sayfa': '', 'Teknik açıklama': p.difference ?? '', 'Yorum': p.comment ?? '' })
      for (const p of activeReport.hazards ?? []) rows.push({ Bölüm: 'Tehlike', Parametre: p.hazard ?? '', Değer: p.whatItMeans ?? '', Birim: '', 'Test metodu': p.sourceSection ?? '', 'Kaynak sayfa': '', 'Teknik açıklama': '', 'Yorum': p.precautions ?? '' })
      for (const item of activeReport.recommendations ?? []) rows.push({ Bölüm: 'Öneri', Parametre: item, Değer: '', Birim: '', 'Test metodu': '', 'Kaynak sayfa': '', 'Teknik açıklama': '', 'Yorum': '' })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Özet: activeReport.executiveSummary ?? '' }]), 'Türkçe Rapor')
      XLSX.writeFile(workbook, `${(activeReport.title || 'teknik-rapor').replace(/[^a-zA-Z0-9-_]/g, '_')}.xlsx`)
    } catch {
      setError('Excel dışa aktarma modülü yüklenemedi. İnternet bağlantısını kontrol edip tekrar deneyin.')
    }
  }

  const printReport = () => window.print()

  return (
    <div className="page-stack tds-sds-page">
      <style>{`
        .tds-sds-page .analysis-hero{background:linear-gradient(125deg,#173d31,#2b6650);color:white;border-radius:16px;padding:24px;margin-bottom:18px}
        .tds-sds-page .analysis-hero p{color:#d8e9df;margin:7px 0 0;max-width:720px}
        .tds-sds-page .analysis-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .tds-sds-page .analysis-card{border:1px solid var(--border,#dfe5e1);border-radius:13px;padding:16px;background:var(--card,#fff)}
        .tds-sds-page .analysis-card h3{margin:0 0 8px;font-size:15px}
        .tds-sds-page .analysis-card p{margin:0;color:var(--muted,#64736b);font-size:13px;line-height:1.55}
        .tds-sds-page .analysis-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .tds-sds-page .analysis-form label{display:block;font-size:13px;font-weight:600;margin-bottom:7px}
        .tds-sds-page .analysis-form input,.tds-sds-page .analysis-form select{width:100%;padding:11px;border:1px solid #d5ddd7;border-radius:9px;background:#fff;color:#1e3027}
        .tds-sds-page .report-block{border:1px solid #dfe5e1;border-radius:12px;padding:16px;margin:12px 0;background:white}
        .tds-sds-page .report-block h3{margin:0 0 10px;color:#204a38;font-size:16px}
        .tds-sds-page .report-table{width:100%;border-collapse:collapse;font-size:13px}
        .tds-sds-page .report-table th,.tds-sds-page .report-table td{border-bottom:1px solid #e4e9e5;padding:9px;text-align:left;vertical-align:top}
        .tds-sds-page .report-table th{background:#f3f7f4;color:#244b39}
        .tds-sds-page .archive-list{display:flex;flex-direction:column;gap:8px}
        .tds-sds-page .archive-item{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #e2e8e4;border-radius:9px;padding:11px}
        .tds-sds-page .muted{color:#69776f;font-size:12px}
        .tds-sds-page .status-note{padding:10px 12px;border-radius:8px;background:#edf5ef;color:#244c38;font-size:13px}
        .tds-sds-page .error-note{padding:10px 12px;border-radius:8px;background:#fff0ed;color:#963d2e;font-size:13px}
        @media(max-width:760px){.tds-sds-page .analysis-grid,.tds-sds-page .analysis-form{grid-template-columns:1fr}}
        @media print{.no-print,.tds-sds-page .analysis-hero,.tds-sds-page .analysis-controls,.tds-sds-page .archive-section{display:none!important}.tds-sds-page{padding:0!important}.tds-sds-page .report-block{break-inside:avoid;border:0;border-bottom:1px solid #ddd}.tds-sds-page .report-table{font-size:10px}}
      `}</style>

      <div className="page-heading">
        <div>
          <h1>TDS / SDS Teknik Analiz</h1>
          <p>İngilizce teknik belgeleri Türkçe analiz et, karşılaştır ve raporla.</p>
        </div>
      </div>

      <section className="analysis-hero">
        <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', opacity: .8 }}>AR-GE · DOKÜMAN ASİSTANI</div>
        <h2 style={{ margin: '8px 0 0', fontSize: 24 }}>Teknik dokümanlardan anlamlı sonuçlara</h2>
        <p>PDF dosyaları özel arşive kaydedilir. Analiz yalnızca yüklediğin belgelere dayanır; internetten kaynak araması yapılmaz.</p>
      </section>

      <div className="analysis-grid analysis-controls">
        <div className="analysis-card"><h3>🧪 TDS teknik analizi</h3><p>Parametreler, test metotları, değerlerin teknik anlamı ve dikkat edilmesi gereken noktalar.</p></div>
        <div className="analysis-card"><h3>🛡️ SDS güvenlik özeti</h3><p>Tehlikeler, korunma önlemleri, KKD, depolama ve acil durum bilgileri.</p></div>
        <div className="analysis-card"><h3>↔ TDS karşılaştırma</h3><p>İki teknik föydeki eşleşen değerler, farklılıklar ve karşılaştırma sınırlamaları.</p></div>
      </div>

      <section className="card analysis-controls" style={{ marginTop: 16 }}>
        <div className="card-header"><h2>Yeni analiz</h2><span className="muted">PDF · En fazla 15 MB / dosya</span></div>
        <div className="card-body">
          <div className="analysis-form">
            <div>
              <label htmlFor="analysis-mode">Analiz türü</label>
              <select id="analysis-mode" value={mode} onChange={(e) => { setMode(e.target.value as Mode); setFirstFile(null); setSecondFile(null); setError(''); setStatus('') }}>
                <option value="tds">TDS — Tek teknik föy</option>
                <option value="sds">SDS / MSDS — Güvenlik bilgi formu</option>
                <option value="comparison">TDS — İki ürünü karşılaştır</option>
              </select>
            </div>
            <div>
              <label htmlFor="first-file">{mode === 'sds' ? 'SDS / MSDS PDF dosyası' : mode === 'comparison' ? 'Birinci TDS PDF dosyası' : 'TDS PDF dosyası'}</label>
              <input id="first-file" type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFirstFile(f); setFirstName(f?.name ?? '') }} />
              {firstName && <div className="muted" style={{ marginTop: 5 }}>{firstName}</div>}
            </div>
            {mode === 'comparison' && <div>
              <label htmlFor="second-file">İkinci TDS PDF dosyası</label>
              <input id="second-file" type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0] ?? null; setSecondFile(f); setSecondName(f?.name ?? '') }} />
              {secondName && <div className="muted" style={{ marginTop: 5 }}>{secondName}</div>}
            </div>}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <button className="btn-primary" disabled={!canAnalyze} onClick={() => void runAnalysis()}>{busy ? 'Analiz ediliyor…' : 'Analizi başlat'}</button>
            <span className="muted">API anahtarı tarayıcıya gönderilmez.</span>
          </div>
          {status && <div className="status-note" style={{ marginTop: 12 }}>{status}</div>}
          {error && <div className="error-note" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </section>

      {activeReport && <section className="report-section" id="printable-report">
        <div className="page-heading no-print" style={{ marginTop: 22 }}>
          <div><h2>Analiz raporu</h2><p>Raporu PDF olarak yazdırabilir veya Excel dosyasına aktarabilirsin.</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={printReport}>PDF olarak kaydet</button>
            <button className="btn-primary" onClick={() => void exportExcel()}>Excel indir</button>
          </div>
        </div>
        <div className="report-block">
          <div className="muted">AR-GE · TÜRKÇE TEKNİK RAPOR</div>
          <h2 style={{ color: '#204a38', margin: '8px 0' }}>{activeReport.title || 'Teknik analiz raporu'}</h2>
          <div className="muted">{labelForType(activeReport.documentType || mode)} · Rapor yapay zekâ destekli hazırlanmıştır; kaynak belge esas alınmalıdır.</div>
          <p style={{ lineHeight: 1.7, marginTop: 16 }}>{activeReport.executiveSummary || 'Özet bulunmuyor.'}</p>
        </div>
        {!!activeReport.parameters?.length && <div className="report-block"><h3>Teknik parametreler</h3><div style={{ overflowX: 'auto' }}><table className="report-table"><thead><tr><th>Parametre</th><th>Değer</th><th>Birim</th><th>Metot / sayfa</th><th>Teknik anlamı ve yorum</th></tr></thead><tbody>{activeReport.parameters.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.value}</td><td>{p.unit}</td><td>{p.testMethod}<br />{p.sourcePage ? `Sayfa: ${p.sourcePage}` : ''}</td><td>{p.technicalMeaning}<br /><strong>{p.interpretation}</strong></td></tr>)}</tbody></table></div></div>}
        {!!activeReport.comparison?.length && <div className="report-block"><h3>Ürün karşılaştırması</h3><div style={{ overflowX: 'auto' }}><table className="report-table"><thead><tr><th>Parametre</th><th>Ürün A</th><th>Ürün B</th><th>Fark</th><th>Teknik değerlendirme</th></tr></thead><tbody>{activeReport.comparison.map((p, i) => <tr key={i}><td>{p.parameter}</td><td>{p.documentA}</td><td>{p.documentB}</td><td>{p.difference}</td><td>{p.comment}</td></tr>)}</tbody></table></div></div>}
        {!!activeReport.hazards?.length && <div className="report-block"><h3>Tehlikeler ve korunma önlemleri</h3>{activeReport.hazards.map((p, i) => <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid #e7ece8' }}><strong>{p.hazard}</strong><p style={{ margin: '5px 0' }}>{p.whatItMeans}</p><p style={{ margin: '5px 0' }}><strong>Önlem:</strong> {p.precautions}</p><div className="muted">Kaynak bölüm: {p.sourceSection}</div></div>)}</div>}
        {!!activeReport.safetyChecklist?.length && <div className="report-block"><h3>Güvenlik kontrol listesi</h3><ul>{activeReport.safetyChecklist.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}</ul></div>}
        {!!activeReport.missingInformation?.length && <div className="report-block"><h3>Belgede bulunmayan / doğrulanması gereken bilgiler</h3><ul>{activeReport.missingInformation.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}</ul></div>}
        {!!activeReport.recommendations?.length && <div className="report-block"><h3>Ar-Ge değerlendirmesi ve öneriler</h3><ul>{activeReport.recommendations.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}</ul></div>}
        {!!activeReport.sourceNotes?.length && <div className="report-block"><h3>Kaynak notları</h3><ul>{activeReport.sourceNotes.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}</ul></div>}
        <div className="muted" style={{ padding: '10px 2px' }}>Not: Bu rapor teknik incelemeyi destekler; üretici belgesinin, resmî SDS'nin veya laboratuvar doğrulamasının yerine geçmez.</div>
      </section>}

      <section className="card archive-section" style={{ marginTop: 20 }}>
        <div className="card-header"><h2>Özel belge arşivi</h2><button className="btn-secondary" onClick={() => void loadArchive()}>Yenile</button></div>
        <div className="card-body">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Yüklenen belgeler ({documents.length})</h3>
          <div className="archive-list">
            {documents.length === 0 && <p className="muted">Henüz belge yüklenmedi.</p>}
            {documents.map((doc) => <div className="archive-item" key={doc.id}><div><strong>{doc.file_name}</strong><div className="muted">{doc.document_type.toUpperCase()} · {formatBytes(doc.file_size)} · {prettyDate(doc.created_at)}</div></div><button className="btn-secondary" onClick={() => void openDocument(doc)}>PDF aç</button></div>)}
          </div>
          <h3 style={{ fontSize: 14, margin: '22px 0 10px' }}>Önceki raporlar ({reports.length})</h3>
          <div className="archive-list">
            {reports.length === 0 && <p className="muted">Henüz analiz raporu yok.</p>}
            {reports.map((report) => <div className="archive-item" key={report.id}><div><strong>{report.title}</strong><div className="muted">{labelForType(report.report_type)} · {prettyDate(report.created_at)}</div></div><button className="btn-secondary" onClick={() => openSavedReport(report)}>Aç</button></div>)}
          </div>
        </div>
      </section>
    </div>
  )
}
