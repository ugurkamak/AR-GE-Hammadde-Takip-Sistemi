import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'
import { parseSampleNo } from '../lib/helpers'
import { supabase } from '../lib/supabase'

export default function ScanQr() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const nav = useNavigate()
  const [state, setState] = useState<'idle' | 'running' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')

  const stop = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }

  useEffect(() => stop, [])

  const start = async () => {
    setErr('')
    try {
      const reader = new BrowserMultiFormatReader()
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (!result) return
        const sample = parseSampleNo(result.getText())
        stop()
        if (sample) nav(`/numune/${sample}`)
        else {
          setState('error')
          setErr('Okunan QR bu sisteme ait bir numune kodu icermiyor.')
        }
      })
      setState('running')
    } catch (e: any) {
      setState('error')
      setErr(
        e?.name === 'NotAllowedError'
          ? 'Kamera izni verilmedi. Tarayici ayarlarindan bu site icin kamerayi acin.'
          : 'Kamera baslatilamadi: ' + (e?.message ?? ''),
      )
    }
  }

  const goManual = async () => {
    const sample = parseSampleNo(manual) ?? manual.trim().toUpperCase()
    const { data } = await supabase.from('materials').select('id').eq('sample_no', sample).maybeSingle()
    if (data) nav(`/numune/${sample}`)
    else setErr(`${sample} numarali numune bulunamadi.`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>QR kod okut</h1>
          <p>Kabin uzerindeki etiketi telefon kamerasina gosterin; numune sayfasi dogrudan acilir.</p>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      <div className="grid col-2">
        <div className="card">
          <div className="card-b qr-box">
            <div className="scanner"><video ref={videoRef} muted playsInline /></div>
            {state !== 'running' ? (
              <button className="btn-accent btn-lg" onClick={start}>Kamerayi baslat</button>
            ) : (
              <button className="btn-lg" onClick={() => { stop(); setState('idle') }}>Kamerayi durdur</button>
            )}
            <p className="small muted" style={{ textAlign: 'center' }}>
              Kamera erisimi icin sayfanin https adresinden acilmasi gerekir. GitHub Pages bu sarti saglar.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Numune numarasi ile ac</h2></div>
          <div className="card-b">
            <p className="small muted">QR yipranmissa etiketteki numarayi yazip numuneye ulasabilirsiniz.</p>
            <div className="field">
              <label>Numune no</label>
              <input placeholder="ARGE-2026-0042" value={manual} onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && goManual()} />
            </div>
            <button className="btn-primary" onClick={goManual} disabled={!manual.trim()}>Numuneyi ac</button>
          </div>
        </div>
      </div>
    </>
  )
}
