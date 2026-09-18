import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp, session } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) nav('/', { replace: true })
  }, [session, nav])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
        nav('/', { replace: true })
      } else {
        await signUp(email.trim(), password, fullName.trim())
        setInfo('Hesap olusturuldu. E-posta dogrulamasi aciksa gelen kutunuzu kontrol edin, ardindan giris yapin.')
        setMode('in')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="swatches" aria-hidden>
          <i style={{ background: '#e0a526' }} />
          <i style={{ background: '#c0392b' }} />
          <i style={{ background: '#17706e' }} />
          <i style={{ background: '#2b6cb0' }} />
        </div>
        <h1>Depodaki her numunenin izi kayitli.</h1>
        <p>
          Firmadan gelen hammadde sisteme girilir, numune numarasi ve QR etiketi olusur, rafa yerlesir.
          Laboratuvarda QR okutulur, kullanilan miktar ve test sonucu kaydedilir. Stok hareketten hesaplanir.
        </p>
      </div>

      <div className="login-form">
        <form className="inner" onSubmit={submit}>
          <h2 style={{ marginBottom: 4 }}>{mode === 'in' ? 'Giris yap' : 'Hesap olustur'}</h2>
          <p className="muted small mb">
            {mode === 'in' ? 'Kurum e-posta adresiniz ile giris yapin.' : 'Ilk kayit olan hesap yonetici yetkisi alir.'}
          </p>

          {err && <div className="alert alert-err">{err}</div>}
          {info && <div className="alert alert-ok">{info}</div>}

          {mode === 'up' && (
            <div className="field">
              <label>Ad soyad <span className="req">*</span></label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label>E-posta <span className="req">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label>Sifre <span className="req">*</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </div>
          <button className="btn-primary btn-lg" disabled={busy}>
            {busy ? 'Bekleyin…' : mode === 'in' ? 'Giris yap' : 'Hesabi olustur'}
          </button>
          <p className="small mt">
            {mode === 'in' ? (
              <>Hesabiniz yok mu? <a href="#" onClick={(e) => { e.preventDefault(); setMode('up') }}>Hesap olusturun</a></>
            ) : (
              <>Zaten hesabiniz var mi? <a href="#" onClick={(e) => { e.preventDefault(); setMode('in') }}>Giris yapin</a></>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
