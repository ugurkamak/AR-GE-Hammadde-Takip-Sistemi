import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dt, exportCsv, qty } from '../lib/helpers'
import { NOT_USED_REASONS, RESULT_LABEL } from '../lib/constants'
import { ResultBadge } from '../components/Badges'
import type { TestRecord, Usage } from '../lib/types'

export default function UsageTests() {
  const [tab, setTab] = useState<'kullanim' | 'test'>('kullanim')
  const [usages, setUsages] = useState<Usage[]>([])
  const [tests, setTests] = useState<TestRecord[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('usages').select('*, profiles(full_name), materials(name, sample_no, unit)')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setUsages((data as Usage[]) ?? []))
    supabase.from('test_results').select('*, profiles(full_name), materials(name, sample_no)')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setTests((data as TestRecord[]) ?? []))
  }, [])

  const term = q.trim().toLocaleLowerCase('tr')
  const fu = useMemo(() => usages.filter((u) => !term || `${u.materials?.name} ${u.materials?.sample_no} ${u.profiles?.full_name} ${u.project ?? ''}`.toLocaleLowerCase('tr').includes(term)), [usages, term])
  const ft = useMemo(() => tests.filter((t) => !term || `${t.materials?.name} ${t.materials?.sample_no} ${t.profiles?.full_name} ${t.title ?? ''}`.toLocaleLowerCase('tr').includes(term)), [tests, term])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kullanim & testler</h1>
          <p>Tum kullanim kayitlari ve test sonuclari tek listede. Kayitlar silinmez, yalnizca eklenir.</p>
        </div>
        <button onClick={() =>
          tab === 'kullanim'
            ? exportCsv('kullanimlar', fu.map((u) => ({
                Tarih: dt(u.created_at), Kullanici: u.profiles?.full_name ?? '', Numune: u.materials?.sample_no ?? '',
                Hammadde: u.materials?.name ?? '', Durum: u.is_used ? 'Kullanildi' : 'Kullanilmadi',
                Miktar: u.quantity, Birim: u.unit, Proje: u.project ?? '', Deneme: u.trial_no ?? '', Aciklama: u.note ?? '',
              })))
            : exportCsv('test-sonuclari', ft.map((t) => ({
                Tarih: dt(t.tested_at, false), Numune: t.materials?.sample_no ?? '', Hammadde: t.materials?.name ?? '',
                Test: t.title ?? '', Sonuc: RESULT_LABEL[t.result], Giren: t.profiles?.full_name ?? '', Aciklama: t.description ?? '',
              })))
        }>CSV indir</button>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={tab === 'kullanim' ? 'active' : ''} onClick={() => setTab('kullanim')}>Kullanimlar ({fu.length})</button>
          <button className={tab === 'test' ? 'active' : ''} onClick={() => setTab('test')}>Test sonuclari ({ft.length})</button>
        </div>
        <div className="card-b">
          <div className="field" style={{ maxWidth: 380 }}>
            <label>Ara</label>
            <input placeholder="Hammadde, numune no, kullanici veya proje" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="table-wrap">
            {tab === 'kullanim' ? (
              <table>
                <thead><tr><th>Tarih</th><th>Kullanici</th><th>Numune</th><th>Hammadde</th><th>Durum</th><th>Miktar</th><th>Proje / deneme</th><th className="wrap">Aciklama</th></tr></thead>
                <tbody>
                  {fu.map((u) => (
                    <tr key={u.id}>
                      <td>{dt(u.created_at)}</td>
                      <td>{u.profiles?.full_name ?? '-'}</td>
                      <td className="mono"><Link to={`/numune/${u.materials?.sample_no}`}>{u.materials?.sample_no}</Link></td>
                      <td>{u.materials?.name}</td>
                      <td>{u.is_used ? 'Kullanildi' : NOT_USED_REASONS[u.not_used_reason ?? 'diger']}</td>
                      <td>{u.is_used || u.returned ? qty(u.quantity, u.unit) : '-'}</td>
                      <td>{[u.project, u.trial_no].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="wrap">{u.note ?? '-'}</td>
                    </tr>
                  ))}
                  {!fu.length && <tr><td colSpan={8} className="empty"><strong>Kayit yok</strong>QR okutup kullanim girildiginde burada gorunur.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table>
                <thead><tr><th>Tarih</th><th>Numune</th><th>Hammadde</th><th>Test</th><th>Sonuc</th><th>Giren</th><th className="wrap">Aciklama</th></tr></thead>
                <tbody>
                  {ft.map((t) => (
                    <tr key={t.id}>
                      <td>{dt(t.tested_at, false)}</td>
                      <td className="mono"><Link to={`/numune/${t.materials?.sample_no}`}>{t.materials?.sample_no}</Link></td>
                      <td>{t.materials?.name}</td>
                      <td>{t.title ?? '-'}</td>
                      <td><ResultBadge value={t.result} /></td>
                      <td>{t.profiles?.full_name ?? '-'}</td>
                      <td className="wrap">{t.description ?? '-'}</td>
                    </tr>
                  ))}
                  {!ft.length && <tr><td colSpan={7} className="empty"><strong>Test sonucu yok</strong>Numune detayindan sonuc girebilirsiniz.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
