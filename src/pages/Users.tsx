import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dt } from '../lib/helpers'
import type { ActivityLog, Profile } from '../lib/types'

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => setUsers((data as Profile[]) ?? []))
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setLogs((data as ActivityLog[]) ?? []))
  }
  useEffect(load, [])

  const update = async (u: Profile, role: string, active: boolean) => {
    const { error } = await supabase.rpc('set_user_role', { p_user: u.id, p_role: role, p_active: active })
    if (error) setErr(error.message)
    else { setMsg(`${u.full_name} guncellendi.`); setTimeout(() => setMsg(''), 3000); load() }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kullanicilar</h1>
          <p>Yonetici hammadde ekler, stok duzeltir ve depo konumu degistirir. AR-GE kullanicisi numune goruntuler, kullanim ve test sonucu girer.</p>
        </div>
      </div>

      {msg && <div className="alert alert-ok">{msg}</div>}
      {err && <div className="alert alert-err">{err}</div>}

      <div className="card mb">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ad soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Kayit</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => update(u, e.target.value, u.is_active)} style={{ width: 'auto' }}>
                      <option value="admin">Yonetici / depo sorumlusu</option>
                      <option value="user">AR-GE kullanicisi</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn-sm" onClick={() => update(u, u.role, !u.is_active)}>
                      {u.is_active ? 'Aktif · pasife al' : 'Pasif · aktif et'}
                    </button>
                  </td>
                  <td>{dt(u.created_at, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Kullanici islem gecmisi</h2><span className="small muted">Son 100 kayit, silinemez</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tarih</th><th>Kullanici</th><th>Islem</th><th>Numune</th><th className="wrap">Detay</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{dt(l.created_at)}</td>
                  <td>{l.user_name ?? '-'}</td>
                  <td>{l.action}</td>
                  <td className="mono">{l.sample_no ?? '-'}</td>
                  <td className="wrap">{l.detail ?? '-'}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={5} className="empty">Kayit yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
