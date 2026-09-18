import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Materials from './pages/Materials'
import MaterialNew from './pages/MaterialNew'
import MaterialDetail from './pages/MaterialDetail'
import ScanQr from './pages/ScanQr'
import UsageTests from './pages/UsageTests'
import Warehouse from './pages/Warehouse'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Labels from './pages/Labels'

export default function App() {
  return (
    <Routes>
      <Route path="/giris" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="hammaddeler" element={<Materials />} />
        <Route path="hammadde-girisi" element={<ProtectedRoute adminOnly><MaterialNew /></ProtectedRoute>} />
        <Route path="hammadde/:id" element={<MaterialDetail />} />
        <Route path="numune/:sampleNo" element={<MaterialDetail bySampleNo />} />
        <Route path="qr-okut" element={<ScanQr />} />
        <Route path="kullanim-testler" element={<UsageTests />} />
        <Route path="depo" element={<Warehouse />} />
        <Route path="raporlar" element={<Reports />} />
        <Route path="etiketler" element={<Labels />} />
        <Route path="kullanicilar" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="ayarlar" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
