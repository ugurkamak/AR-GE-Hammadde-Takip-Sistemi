import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import { dt, qty } from '../lib/helpers'
import { RESULT_COLOR, RESULT_LABEL } from '../lib/constants'
import { ResultBadge } from '../components/Badges'
import type { ActivityLog, Material, TestResult, Usage } from '../lib/types'

type Stats = Record<string, number>

export default function Dashboard() {
  const nav = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<Material[]>([])
  const [usages, setUsages] = useState<Usage[]>([])
  const [pending, setPending] = useState<Material[]>([])
  const [critical, setCritical] = useState<Material[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [s, r, u, p, c, l] = await Promise.all([
        supabase.rpc('dashboard_stats'),
        supabase.from('materials_view').select('*').order('created_at', { ascending: false }).limit(10),
        supabase
          .from('usages')
          .select('*, profiles(full_name), materials(name, sample_no, unit)')
          .eq('is_used', true)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('materials_view').select('*').eq('test_result', 'bekliyor').order('arrival_date').limit(8),
        supabase.from('materials_view').select('*').eq('is_critical', true).order('name').limit(8),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ])
      setStats((s.data as Stats) ?? null)
      setRecent((r.data as Material[]) ?? [])
      setUsages((u.data as Usage[]) ?? [])
      setPending((p.data as Material[]) ?? [])
      setCritical((c.data as Material[]) ?? [])
      setLogs((l.data as ActivityLog[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="spinner">Yukleniyor…</div>

  const cards: { key: string; label: string; to: string; color: string }[] = [
    { key: 'toplam', label: 'Toplam hammadde', to: '/hammaddeler', color: '#2b3c4e' },
    { key: 'depoda', label: 'Depoda', to: '/hammaddeler?durum=depoda', color: '#2b6cb0' },
    { key: 'test_bekleyen', label: 'Test bekleyen', to: '/hammaddeler?sonuc=bekliyor', color: '#b58105' },
    { key: 'kullanimda', label: 'Kullanimda', to: '/hammaddeler?durum=kullanimda', color: '#d9772b' },
    { key: 'olumlu', label: 'Olumlu', to: '/hammaddeler?sonuc=olumlu', color: '#2f8f5b' },
    { key: 'olumsuz', label: 'Olumsuz', to: '/hammaddeler?sonuc=olumsuz', color: '#c0392b' },
    { key: 'kritik', label: 'Kritik stok', to: '/hammaddeler?kritik=1', color: '#c0392b' },
    { key: 'biten', label: 'Biten', to: '/hammaddeler?durum=bitti', color: '#7a8691' },
  ]

  const pie = (['olumlu', 'olumsuz', 'kismen', 'tekrar', 'bekliyor'] as TestResult[])
    .map((k) => ({ name: RESULT_LABEL[k], value: stats?.[k === 'bekliyor' ? 'test_bekleyen' : k] ?? 0, color: RESULT_COLOR[k] }))
    .filter((d) => d.value > 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Depodaki numunelerin anlik durumu, son hareketler ve sonucu bekleyen testler.</p>
        </div>
        <div className="btn-row">
          <Link className="btn" to="/qr-okut">📱 QR okut</Link>
          <Link className="btn btn-accent" to="/hammadde-girisi">➕ Hammadde girisi</Link>
        </div>
      </div>

      <div className="grid stat-grid mb">
        {cards.map((c) => (
          <button key={c.key} className="stat" style={{ borderLeftColor: c.color }} onClick={() => nav(c.to)}>
            <span className="n">{stats?.[c.key] ?? 0}</span>
            <span className="l">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="grid col-2">
        <section className="card">
          <div className="card-h">
            <h2>Son gelen hammaddeler</h2>
            <Link className="small" to="/hammaddeler">Tumu</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Numune</th><th>Hammadde</th><th>Firma</th><th>Stok</th><th>Raf</th></tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id} onClick={() => nav(`/hammadde/${m.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{m.sample_no}</td>
                    <td>{m.name}</td>
                    <td>{m.supplier}</td>
                    <td>{qty(m.current_stock, m.unit)}</td>
                    <td><span className="chip">{m.shelf_code}</span></td>
                  </tr>
                ))}
                {!recent.length && <tr><td colSpan={5} className="empty"><strong>Henuz kayit yok</strong>Ilk hammadde girisini yapin.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Son kullanimlar</h2><Link className="small" to="/kullanim-testler">Tumu</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tarih</th><th>Kullanan</th><th>Hammadde</th><th>Miktar</th></tr></thead>
              <tbody>
                {usages.map((u) => (
                  <tr key={u.id}>
                    <td>{dt(u.created_at)}</td>
                    <td>{u.profiles?.full_name ?? '-'}</td>
                    <td>{u.materials?.name}</td>
                    <td>{qty(u.quantity, u.unit)}</td>
                  </tr>
                ))}
                {!usages.length && <tr><td colSpan={4} className="empty"><strong>Kullanim kaydi yok</strong>QR okutup ilk kullanimi girin.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Test sonucu bekleyenler</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Numune</th><th>Hammadde</th><th>Geliş</th><th></th></tr></thead>
              <tbody>
                {pending.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.sample_no}</td>
                    <td>{m.name}</td>
                    <td>{dt(m.arrival_date, false)}</td>
                    <td className="right"><Link className="btn btn-sm" to={`/hammadde/${m.id}`}>Sonuc gir</Link></td>
                  </tr>
                ))}
                {!pending.length && <tr><td colSpan={4} className="empty"><strong>Bekleyen test yok</strong>Tum numunelerin sonucu girilmis.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Kritik stoklar</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hammadde</th><th>Mevcut</th><th>Minimum</th><th>Raf</th></tr></thead>
              <tbody>
                {critical.map((m) => (
                  <tr key={m.id} onClick={() => nav(`/hammadde/${m.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{m.name}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>{qty(m.current_stock, m.unit)}</td>
                    <td>{qty(m.min_stock, m.unit)}</td>
                    <td><span className="chip">{m.shelf_code}</span></td>
                  </tr>
                ))}
                {!critical.length && <tr><td colSpan={4} className="empty"><strong>Kritik seviyede hammadde yok</strong>Stoklar minimum seviyenin uzerinde.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Son islemler</h2></div>
          <div className="card-b">
            <ul className="timeline">
              {logs.map((l) => (
                <li key={l.id}>
                  <div className="t">{dt(l.created_at)} · {l.user_name ?? '-'}</div>
                  <div>{l.action}{l.sample_no ? ` · ${l.sample_no}` : ''}</div>
                  {l.detail && <div className="small muted">{l.detail}</div>}
                </li>
              ))}
              {!logs.length && <li className="muted">Henuz islem yok.</li>}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Sonuc dagilimi</h2></div>
          <div className="card-b" style={{ height: 280 }}>
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {pie.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty"><strong>Grafik icin veri yok</strong>Test sonuclari girildikce burada dagilim gorunur.</div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
