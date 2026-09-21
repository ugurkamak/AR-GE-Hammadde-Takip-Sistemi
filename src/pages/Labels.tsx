import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QrImage from '../components/QrImage'
import type { Material } from '../lib/types'

export default function Labels() {
  const [params] = useSearchParams()

  const [rows, setRows] = useState<Material[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(false)

  const [editName, setEditName] = useState('')
  const [editSupplier, setEditSupplier] = useState('')
  const [editArrivalDate, setEditArrivalDate] = useState('')
  const [editInitialQuantity, setEditInitialQuantity] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editShelfCode, setEditShelfCode] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('materials')
        .select(
          `
          id,
          sample_no,
          name,
          supplier,
          product_code,
          lot_no,
          arrival_date,
          initial_quantity,
          unit,
          package_info,
          min_stock,
          section,
          shelf_no,
          level_no,
          bin_no,
          shelf_code,
          material_type,
          pigment_type,
          color,
          technical_spec,
          usage_purpose,
          description,
          status,
          test_result,
          created_by,
          created_at,
          updated_at
          `,
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        alert(`Hammadde bilgileri alınamadı: ${error.message}`)
        return
      }

      const list = (data as Material[]) ?? []

      setRows(list)

      const pre = params.get('numune')

      if (pre) {
        const hit = list.find(
          (m) => m.sample_no === pre,
        )

        if (hit) {
          setSelected([hit.id])
        }
      }
    }

    load()
  }, [params])

  const term = q.trim().toLocaleLowerCase('tr')

  const filtered = useMemo(
    () =>
      rows.filter(
        (m) =>
          !term ||
          `${m.name} ${m.sample_no} ${m.lot_no} ${m.supplier} ${m.shelf_code}`
            .toLocaleLowerCase('tr')
            .includes(term),
      ),
    [rows, term],
  )

  const chosen = rows.filter((m) =>
    selected.includes(m.id),
  )

  const current = chosen[0] ?? null

  /*
   * RAF SİSTEMİ
   *
   * A = Yeşil Raf
   * B = Mavi Raf
   * C = Kırmızı Raf
   */
  const getShelfInfo = (material: Material | null) => {
    if (!material) {
      return {
        section: '',
        name: 'Raf',
        colorClass: 'shelf-default',
        code: '-',
      }
    }

    const section = String(material.section || '')
      .trim()
      .toUpperCase()

    let name = 'Raf'
    let colorClass = 'shelf-default'

    if (section === 'A') {
      name = 'Yeşil Raf'
      colorClass = 'shelf-green'
    } else if (section === 'B') {
      name = 'Mavi Raf'
      colorClass = 'shelf-blue'
    } else if (section === 'C') {
      name = 'Kırmızı Raf'
      colorClass = 'shelf-red'
    }

    /*
     * Raf kodunu otomatik oluştur.
     *
     * Örnek:
     * C + 1 + 1 + 1
     * = C-01-01-01
     *
     * Eğer raf numaraları mevcut değilse eski
     * shelf_code değeri korunur.
     */
    const shelfNo =
      material.shelf_no !== null &&
      material.shelf_no !== undefined
        ? Number(material.shelf_no)
        : null

    const levelNo =
      material.level_no !== null &&
      material.level_no !== undefined
        ? Number(material.level_no)
        : null

    const binNo =
      material.bin_no !== null &&
      material.bin_no !== undefined
        ? Number(material.bin_no)
        : null

    let code = material.shelf_code || '-'

    if (
      section &&
      shelfNo !== null &&
      levelNo !== null &&
      binNo !== null &&
      !Number.isNaN(shelfNo) &&
      !Number.isNaN(levelNo) &&
      !Number.isNaN(binNo)
    ) {
      code = `${section}-${String(shelfNo).padStart(2, '0')}-${String(
        levelNo,
      ).padStart(2, '0')}-${String(binNo).padStart(2, '0')}`
    }

    return {
      section,
      name,
      colorClass,
      code,
    }
  }

  const shelfInfo = getShelfInfo(current)

  const selectMaterial = (id: string) => {
    setSelected([id])
    setEditing(false)
  }

  const startEdit = () => {
    if (!current) return

    const info = getShelfInfo(current)

    setEditName(current.name ?? '')
    setEditSupplier(current.supplier ?? '')
    setEditArrivalDate(current.arrival_date ?? '')
    setEditInitialQuantity(
      String(current.initial_quantity ?? ''),
    )
    setEditUnit(current.unit ?? '')
    setEditShelfCode(info.code === '-' ? '' : info.code)

    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
  }

  const saveEdit = async () => {
    if (!current) return

    if (!editName.trim()) {
      alert('Hammadde adı zorunludur.')
      return
    }

    if (!editSupplier.trim()) {
      alert('Firma / tedarikçi zorunludur.')
      return
    }

    if (!editArrivalDate) {
      alert('Geliş tarihi zorunludur.')
      return
    }

    if (
      !editInitialQuantity ||
      Number(editInitialQuantity) <= 0
    ) {
      alert('Gelen miktar 0’dan büyük olmalıdır.')
      return
    }

    if (!editUnit.trim()) {
      alert('Birim zorunludur.')
      return
    }

    const { error } = await supabase
      .from('materials')
      .update({
        name: editName.trim(),
        supplier: editSupplier.trim(),
        arrival_date: editArrivalDate,
        initial_quantity: Number(editInitialQuantity),
        unit: editUnit.trim(),
        shelf_code: editShelfCode.trim(),
      })
      .eq('id', current.id)

    if (error) {
      console.error(error)
      alert(`Değişiklik kaydedilemedi: ${error.message}`)
      return
    }

    const updated: Material = {
      ...current,
      name: editName.trim(),
      supplier: editSupplier.trim(),
      arrival_date: editArrivalDate,
      initial_quantity: Number(editInitialQuantity),
      unit: editUnit.trim(),
      shelf_code: editShelfCode.trim(),
    }

    setRows((prev) =>
      prev.map((m) =>
        m.id === current.id ? updated : m,
      ),
    )

    setEditing(false)

    alert('Etiket bilgileri güncellendi.')
  }

  const formatDate = (value: string) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString('tr-TR')
  }

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>QR Etiketleri</h1>

          <p>
            Bir numune seçin. Etiket A4 kağıdının ortasına
            yaklaşık A6 boyutunda tek adet olarak yazdırılır.
          </p>
        </div>

        <div className="btn-row">
          {current && !editing && (
            <>
              <button
                className="btn"
                onClick={startEdit}
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

      <div className="card mb no-print">
        <div className="card-b">
          <div className="row mb">
            <div
              className="field search-wide"
              style={{ margin: 0 }}
            >
              <label>Ara</label>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Hammadde, numune, lot veya raf"
              />
            </div>

            <button
              onClick={() => {
                if (filtered.length > 0) {
                  setSelected([filtered[0].id])
                }
              }}
            >
              İlk numuneyi seç
            </button>

            <button
              onClick={() => setSelected([])}
            >
              Seçimi temizle
            </button>
          </div>

          <div
            className="table-wrap"
            style={{
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Numune</th>
                  <th>Hammadde</th>
                  <th>Lot</th>
                  <th>Raf</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() =>
                      selectMaterial(m.id)
                    }
                    style={{
                      cursor: 'pointer',
                      background:
                        selected.includes(m.id)
                          ? 'rgba(0,0,0,0.05)'
                          : undefined,
                    }}
                  >
                    <td>
                      <input
                        type="radio"
                        checked={selected.includes(m.id)}
                        onChange={() =>
                          selectMaterial(m.id)
                        }
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      />
                    </td>

                    <td>{m.sample_no}</td>
                    <td>{m.name}</td>
                    <td>{m.lot_no}</td>
                    <td>{m.shelf_code || '-'}</td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: 'center',
                        padding: 20,
                      }}
                    >
                      Hammadde bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && current && (
        <div className="card mb no-print">
          <div className="card-b">
            <h3>Etiket Bilgilerini Düzenle</h3>

            <div className="grid-2">
              <div className="field">
                <label>Hammadde adı *</label>
                <input
                  value={editName}
                  onChange={(e) =>
                    setEditName(e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Firma / tedarikçi *</label>
                <input
                  value={editSupplier}
                  onChange={(e) =>
                    setEditSupplier(e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Geliş tarihi *</label>
                <input
                  type="date"
                  value={editArrivalDate}
                  onChange={(e) =>
                    setEditArrivalDate(e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Gelen miktar *</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={editInitialQuantity}
                  onChange={(e) =>
                    setEditInitialQuantity(e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Birim *</label>
                <input
                  value={editUnit}
                  onChange={(e) =>
                    setEditUnit(e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Raf kodu</label>
                <input
                  value={editShelfCode}
                  onChange={(e) =>
                    setEditShelfCode(e.target.value)
                  }
                  placeholder="Örn. C-01-01-01"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {current && !editing && (
        <div
          className="no-print"
          style={{ marginBottom: 20 }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fff8d8',
              border: '1px solid #eadf9a',
              fontSize: 14,
            }}
          >
            Seçili numune:{' '}
            <strong>{current.sample_no}</strong>
            {' — '}
            {current.name}
            {' — Raf: '}
            <strong>{shelfInfo.code}</strong>
          </div>
        </div>
      )}

      {current && !editing && (
        <div className="label-print-area">
          <div className="single-label">
            <div className="label-header">
              AR-GE HAMMADDE
            </div>

            <div className="label-qr">
              <QrImage
                sampleNo={current.sample_no}
                size={48 * 3}
              />
            </div>

            <div className="label-sample">
              {current.sample_no}
            </div>

            <div className="label-info">
              <div className="label-row">
                <span>Hammadde adı</span>
                <strong>
                  {current.name || '-'}
                </strong>
              </div>

              <div className="label-row">
                <span>Firma / tedarikçi</span>
                <strong>
                  {current.supplier || '-'}
                </strong>
              </div>

              <div className="label-row">
                <span>Geliş tarihi</span>
                <strong>
                  {formatDate(current.arrival_date)}
                </strong>
              </div>

              <div className="label-row">
                <span>Gelen miktar</span>
                <strong>
                  {current.initial_quantity ?? '-'}
                </strong>
              </div>

              <div className="label-row">
                <span>Birim</span>
                <strong>
                  {current.unit || '-'}
                </strong>
              </div>

              <div className="label-row shelf-place-row">
                <span>Raf Yeri</span>
                <strong
                  className={shelfInfo.colorClass}
                >
                  {shelfInfo.section
                    ? `${shelfInfo.section} · ${shelfInfo.name}`
                    : '-'}
                </strong>
              </div>

              <div className="label-row">
                <span>Raf Kodu</span>
                <strong className="shelf-code-value">
                  {shelfInfo.code}
                </strong>
              </div>
            </div>

            <div className="label-footer">
              AR-GE Hammadde Takip Sistemi
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .label-print-area {
            width: 100%;
            min-height: 620px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
          }

          .single-label {
            width: 105mm;
            height: 148mm;
            box-sizing: border-box;
            background: white;
            border: 1px solid #222;
            border-radius: 3mm;
            padding: 6mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow: hidden;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .label-header {
            width: 100%;
            text-align: center;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 3mm;
          }

          .label-qr {
            width: 48mm;
            height: 48mm;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2mm;
            flex-shrink: 0;
          }

          .label-qr img {
            width: 48mm !important;
            height: 48mm !important;
            display: block;
          }

          .label-sample {
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-align: center;
            margin-bottom: 3mm;
            flex-shrink: 0;
          }

          .label-info {
            width: 100%;
            border-top: 1px solid #222;
            border-left: 1px solid #222;
            flex-shrink: 0;
          }

          .label-row {
            width: 100%;
            min-height: 8mm;
            display: grid;
            grid-template-columns: 39% 61%;
            box-sizing: border-box;
            border-bottom: 1px solid #222;
          }

          .label-row span {
            box-sizing: border-box;
            padding: 1.7mm 2mm;
            background: #f1f1f1;
            border-right: 1px solid #222;
            font-size: 8.5px;
            font-weight: 600;
            display: flex;
            align-items: center;
          }

          .label-row strong {
            box-sizing: border-box;
            padding: 1.7mm 2mm;
            font-size: 9.5px;
            font-weight: 700;
            display: flex;
            align-items: center;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .shelf-green {
            color: #16803c !important;
            font-weight: 800 !important;
          }

          .shelf-blue {
            color: #1769aa !important;
            font-weight: 800 !important;
          }

          .shelf-red {
            color: #d62828 !important;
            font-weight: 800 !important;
          }

          .shelf-default {
            color: #111 !important;
            font-weight: 800 !important;
          }

          .shelf-code-value {
            font-size: 10px !important;
            font-weight: 800 !important;
            letter-spacing: 0.3px;
          }

          .label-footer {
            margin-top: auto;
            padding-top: 2mm;
            font-size: 7.5px;
            color: #555;
            text-align: center;
            flex-shrink: 0;
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 210mm;
              height: 297mm;
              background: white !important;
            }

            body * {
              visibility: hidden;
            }

            .label-print-area,
            .label-print-area * {
              visibility: visible;
            }

            .label-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm;
              height: 297mm;
              min-height: 297mm;
              padding: 0;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
            }

            .single-label {
              width: 105mm;
              height: 148mm;
              margin: 0;
              padding: 6mm;
              border: 1px solid #222;
              border-radius: 3mm;
              box-shadow: none;
              overflow: hidden;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
    </>
  )
}
