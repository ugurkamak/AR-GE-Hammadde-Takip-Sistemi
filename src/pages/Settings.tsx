import { useEffect, useState } from 'react'
import { supabase, APP_BASE_URL } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { WarehouseSection } from '../lib/types'

export default function Settings() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const [requireDesc, setRequireDesc] = useState(true)
  const [sections, setSections] = useState<WarehouseSection[]>([])
  const [newSec, setNewSec] = useState({ code: '', name: '', shelf_count: 6, level_count: 4, bin_count: 6 })
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    supabase.from('app_settings').select('*').eq('key', 'require_test_description').maybeSingle()
      .then(({ data }) => setRequireDesc(data?.value === true))
    supabase.from('warehouse_sections').select('*').order('code').then(({ data }) => setSections((data as WarehouseSection[]) ?? []))
  }
  useEffect(load, [])

  const ok = (t: string) => { setMsg(t); setErr(''); setTimeout(() => setMsg(''), 3000); load() }

  const saveSetting = async (v: boolean) => {
    setRequireDesc(v)
    const { error } = await supabase.from('app_settings').update({ value: v }).eq('key', 'require_test_description')
    error ? setErr(error.message) : ok('Ayar kaydedildi.')
  }

  const addSection = async () => {
    const { error } = await supabase.from('warehouse_sections').insert(newSec)
    if (error) return setErr(error.message)
    setNewSec({ code: '', name: '', shelf_count: 6, level_count: 4, bin_count: 6 })
    ok('Depo bolumu eklendi.')
  }

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile!.id)
    if (error) return setErr(error.message)
    await refreshProfile()
    ok('Profiliniz guncellendi.')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <p>Hesap bilgileriniz, test kurallari ve depo bolumleri.</p>
        </div>
      </div>

      {msg && <div className="alert alert-ok">{msg}</div>}
      {err && <div className="alert alert-err">{err}</div>}

      <div className="grid col-2">
        <div className="card">
          <div className="card-h"><h2>Hesabim</h2></div>
          <div className="card-b">
            <div className="field"><label>Ad soyad</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="field"><label>E-posta</label><input value={profile?.email ?? ''} disabled /></div>
            <div className="field"><label>Rol</label><input value={isAdmin ? 'Yonetici / depo sorumlusu' : 'AR-GE kullanicisi'} disabled /></div>
            <button className="btn-primary" onClick={saveProfile}>Kaydet</button>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Sistem</h2></div>
          <div className="card-b">
            <label className="checkline">
              <input type="checkbox" checked={requireDesc} disabled={!isAdmin} onChange={(e) => saveSetting(e.target.checked)} />
              Test sonucu girerken aciklama zorunlu olsun
            </label>
            <div className="field mt"><label>QR adres onegi</label><input value={APP_BASE_URL} disabled /></div>
            <p className="small muted">QR kodlar bu adresi kullanir. Degistirmek icin .env dosyasindaki VITE_APP_BASE_URL degerini guncelleyip yeniden yayinlayin.</p>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-h"><h2>Depo bolumleri</h2></div>
          <div className="card-b">
            <div className="table-wrap mb">
              <table>
                <thead><tr><th>Kod</th><th>Ad</th><th>Raf</th><th>Kat</th><th>Goz</th></tr></thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.code}><td className="mono">{s.code}</td><td>{s.name}</td><td>{s.shelf_count}</td><td>{s.level_count}</td><td>{s.bin_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="filters">
                <div className="field"><label>Kod</label><input maxLength={2} value={newSec.code} onChange={(e) => setNewSec({ ...newSec, code: e.target.value.toUpperCase() })} placeholder="D" /></div>
                <div className="field search-wide"><label>Ad</label><input value={newSec.name} onChange={(e) => setNewSec({ ...newSec, name: e.target.value })} placeholder="D Bolumu - Dolgu maddeleri" /></div>
                <div className="field"><label>Raf</label><input type="number" min="1" value={newSec.shelf_count} onChange={(e) => setNewSec({ ...newSec, shelf_count: Number(e.target.value) })} /></div>
                <div className="field"><label>Kat</label><input type="number" min="1" value={newSec.level_count} onChange={(e) => setNewSec({ ...newSec, level_count: Number(e.target.value) })} /></div>
                <div className="field"><label>Goz</label><input type="number" min="1" value={newSec.bin_count} onChange={(e) => setNewSec({ ...newSec, bin_count: Number(e.target.value) })} /></div>
                <button className="btn-primary" onClick={addSection} disabled={!newSec.code}>Bolum ekle</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
