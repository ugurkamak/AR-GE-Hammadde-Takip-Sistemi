import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { sampleUrl } from '../lib/supabase'

/** Numune numarasini tasiyan QR. Icerikte hammadde adi yer almaz. */
export default function QrImage({ sampleNo, size = 160 }: { sampleNo: string; size?: number }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    QRCode.toDataURL(sampleUrl(sampleNo), {
      width: size * 3,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#16202bff', light: '#ffffffff' },
    }).then(setSrc)
  }, [sampleNo, size])

  if (!src) return <div style={{ width: size, height: size, background: '#f1f2ef' }} />
  return <img src={src} width={size} height={size} alt={`${sampleNo} QR kodu`} />
}
