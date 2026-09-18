import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()

  if (loading) return <div className="spinner">Yukleniyor…</div>
  if (!session) return <Navigate to="/giris" state={{ from: loc.pathname }} replace />
  if (profile && !profile.is_active)
    return (
      <div className="card" style={{ margin: 40 }}>
        <div className="card-b">
          <h2>Hesabiniz pasif durumda</h2>
          <p className="muted">Erisim icin depo sorumlusu hesabinizi tekrar aktif etmeli.</p>
        </div>
      </div>
    )
  if (adminOnly && profile?.role !== 'admin')
    return (
      <div className="card">
        <div className="card-b">
          <h2>Bu sayfa yoneticilere acik</h2>
          <p className="muted">Hammadde girisi, kullanici yonetimi ve stok duzeltme yalnizca depo sorumlusu tarafindan yapilir.</p>
        </div>
      </div>
    )
  return <>{children}</>
}
