import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MENU = [
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/hammaddeler', icon: '📦', label: 'Hammadde deposu' },
  { to: '/hammadde-girisi', icon: '➕', label: 'Hammadde girisi', adminOnly: true },
  { to: '/qr-okut', icon: '📱', label: 'QR kod okut' },
  { to: '/kullanim-testler', icon: '🧪', label: 'Kullanim & testler' },
  { to: '/depo', icon: '📍', label: 'Depo / raflar' },
  { to: '/raporlar', icon: '📊', label: 'Raporlar' },
  { to: '/kullanicilar', icon: '👥', label: 'Kullanicilar', adminOnly: true },
  { to: '/ayarlar', icon: '⚙️', label: 'Ayarlar' },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const close = () => setOpen(false)

  return (
    <div className="app">
      {open && <div className="scrim no-print" onClick={close} />}
      <aside className={`sidebar no-print ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">
            <span className="swatch" aria-hidden />
            <span>
              <strong>AR-GE Hammadde</strong>
              <span>Numune ve stok takibi</span>
            </span>
          </div>
        </div>
        <nav className="nav">
          {MENU.filter((m) => !m.adminOnly || isAdmin).map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} onClick={close}>
              <span className="ico" aria-hidden>{m.icon}</span>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{profile?.full_name}</div>
          <div className="role">{isAdmin ? 'Yonetici / depo sorumlusu' : 'AR-GE kullanicisi'}</div>
          <button
            className="btn-sm"
            onClick={async () => {
              await signOut()
              nav('/giris')
            }}
          >
            Cikis yap
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar no-print">
          <button onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <strong style={{ fontSize: 15 }}>AR-GE Hammadde</strong>
          <NavLink to="/qr-okut" style={{ marginLeft: 'auto', color: '#fff' }}>
            📱 QR okut
          </NavLink>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
