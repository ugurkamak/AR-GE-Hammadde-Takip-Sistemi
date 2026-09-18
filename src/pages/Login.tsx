import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, session } = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) {
      nav('/', { replace: true })
    }
  }, [session, nav])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)

    try {
      await signIn(email.trim(), password)
      nav('/', { replace: true })
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
          Firmadan gelen hammadde sisteme girilir, numune numarasi ve QR etiketi olusur,
          rafa yerlesir. Laboratuvarda QR okutulur, kullanilan miktar ve test sonucu
          kaydedilir. Stok hareketten hesaplanir.
        </p>
      </div>

      <div className="login-form">
        <form className="inner" onSubmit={submit}>

          <h2 style={{ marginBottom: 4 }}>
            Giris yap
          </h2>

          <p className="muted small mb">
            Kurum e-posta adresiniz ile giris yapin.
          </p>

          {err && (
            <div className="alert alert-err">
              {err}
            </div>
          )}

          <div className="field">
            <label>
              E-posta <span className="req">*</span>
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>
              Sifre <span className="req">*</span>
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-lg"
            disabled={busy}
          >
            {busy ? 'Bekleyin...' : 'Giris yap'}
          </button>

        </form>
      </div>

    </div>
  )
}
