import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QrImage from '../components/QrImage'
import type { Material } from '../lib/types'

export default function Labels() {
  const [params] = useSearchParams()

  const [material, setMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const [name, setName] = useState('')
  const [sampleNo, setSampleNo] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [shelfCode, setShelfCode] = useState('')

  useEffect(() => {
    const sampleNoParam = params.get('numune')

    if (!sampleNoParam) {
      setLoading(false)
      return
    }

    const loadMaterial = async () => {
      const { data, error } = await supabase
        .from('materials_view')
        .select('*')
        .eq('sample_no', sampleNoParam)
        .maybeSingle()

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      if (data) {
        const m = data as Material

        setMaterial(m)
        setName(m.name ?? '')
        setSampleNo(m.sample_no ?? '')
        setLotNo(m.lot_no ?? '')
        setShelfCode(m.shelf_code ?? '')
      }

      setLoading(false)
    }

    loadMaterial()
  }, [params])

  const startEdit = () => {
    if (!material) return

    setName(material.name ?? '')
    setSampleNo(material.sample_no ?? '')
    setLotNo(material.lot_no ?? '')
    setShelfCode(material.shelf_code ?? '')

    setEditing(true)
  }

  const cancelEdit = () => {
    if (!material) return

    setName(material.name ?? '')
    setSampleNo(material.sample_no ?? '')
    setLotNo(material.lot_no ?? '')
    setShelfCode(material.shelf_code ?? '')

    setEditing(false)
  }

  const saveEdit = async () => {
    if (!material) return

    const { data, error } = await supabase
      .from('materials')
      .update({
        name,
        sample_no: sampleNo,
        lot_no: lotNo,
        shelf_code: shelfCode,
      })
      .eq('id', material.id)
      .select('*')
      .single()

    if (error) {
      console.error(error)
      alert('Değişiklik kaydedilemedi: ' + error.message)
      return
    }

    setMaterial(data as Material)
    setEditing(false)

    alert('Etiket bilgileri güncellendi.')
  }

  if (loading) {
    return (
      <div className="card">
        <div className="empty">
          Etiket bilgileri yükleniyor...
        </div>
      </div>
    )
  }

  if (!material) {
    return (
      <div className="card">
        <div className="empty">
          <strong>Etiket bulunamadı</strong>
          URL içerisinde geçerli bir numune bulunamadı.
        </div>
      </div>
    )
  }

  return (
    <>
      {/* EKRAN KONTROLLERİ */}
      <div className="page-head no-print">
        <div>
          <h1>QR Etiketi</h1>
          <p>Tek etiket A4 kağıdının ortasına A6 boyutunda yazdırılır.</p>
        </div>

        <div className="btn-row">
          {!editing && (
            <>
              <button
                className="btn"
                onClick={startEdit}
                title="Etiketi düzenle"
              >
                ✏️ Düzenle
              </button>

              <button
                className="btn-accent"
                onClick={() => window.print()}
              >
                Yazdır
              </button>
            </>
          )}

          {editing && (
            <>
              <button
                className="btn"
                onClick={cancelEdit}
              >
                İptal
              </button>

              <button
                className="btn-accent"
                onClick={saveEdit}
              >
                Kaydet
              </button>
            </>
          )}
        </div>
      </div>

      {/* DÜZENLEME ALANI */}
      {editing && (
        <div className="card no-print mb">
          <div className="card-b">
            <h3>Etiket Bilgilerini Düzenle</h3>

            <div className="form-grid">

              <div className="field">
                <label>Hammadde</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Numune</label>
                <input
                  value={sampleNo}
                  onChange={(e) => setSampleNo(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Lot</label>
                <input
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Raf</label>
                <input
                  value={shelfCode}
                  onChange={(e) => setShelfCode(e.target.value)}
                />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* A4 YAZDIRMA ALANI */}
      <div className="print-page">

        {/* TEK A6 ETİKET */}
        <div className="single-label">

          <div className="label-qr">
            <QrImage
              sampleNo={sampleNo}
              size={260}
            />
          </div>

          <div className="label-sample">
            {sampleNo}
          </div>

          <div className="label-title">
            AR-GE HAMMADDE
          </div>

          <div className="label-name">
            {name}
          </div>

          <div className="label-info">
            <div>
              <span>Numune</span>
              <strong>{sampleNo}</strong>
            </div>

            <div>
              <span>Lot</span>
              <strong>{lotNo}</strong>
            </div>

            <div>
              <span>Raf</span>
              <strong>{shelfCode}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* YAZDIRMA STİLLERİ */}
      <style>{`
        .print-page {
          width: 210mm;
          height: 297mm;
          margin: 20px auto;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .single-label {
          width: 105mm;
          height: 148mm;
          box-sizing: border-box;

          border: 1px solid #111;
          border-radius: 3mm;

          padding: 8mm;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;

          background: white;
          color: #111;
        }

        .label-qr {
          width: 55mm;
          height: 55mm;

          display: flex;
          align-items: center;
          justify-content: center;

          margin-bottom: 3mm;
        }

        .label-qr img {
          width: 55mm !important;
          height: 55mm !important;
          object-fit: contain;
        }

        .label-sample {
          font-family: monospace;
          font-size: 5mm;
          font-weight: 700;
          letter-spacing: 0.4mm;
          margin-bottom: 4mm;
          text-align: center;
        }

        .label-title {
          font-size: 5mm;
          font-weight: 800;
          letter-spacing: 0.5mm;
          border-bottom: 1px solid #111;
          padding-bottom: 2mm;
          width: 100%;
          text-align: center;
        }

        .label-name {
          font-size: 6mm;
          font-weight: 800;
          text-align: center;
          margin: 5mm 0 6mm;
          word-break: break-word;
        }

        .label-info {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 3mm;
          border-top: 1px solid #ccc;
          padding-top: 5mm;
        }

        .label-info div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5mm;
          font-size: 4mm;
        }

        .label-info span {
          font-weight: 700;
        }

        .label-info strong {
          font-family: monospace;
          font-size: 4mm;
          text-align: right;
        }

        @media print {

          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
          }

          .single-label {
            width: 105mm;
            height: 148mm;
            border: 1px solid #111;
            box-shadow: none;
          }
        }
      `}</style>
    </>
  )
}
