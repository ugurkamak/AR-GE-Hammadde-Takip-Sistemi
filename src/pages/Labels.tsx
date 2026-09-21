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

  /*
   * Raf bilgisini mümkün olan tüm alanlardan bulur.
   *
   * Öncelik:
   * 1. shelf_code
   * 2. shelf_no + level_no + bin_no
   */
  const getShelfCode = (material: Material | null) => {
    if (!material) return ''

    if (material.shelf_code) {
      return String(material.shelf_code)
    }

    const parts: string[] = []

    if (
      material.shelf_no !== null &&
      material.shelf_no !== undefined
    ) {
      parts.push(`Raf ${material.shelf_no}`)
    }

    if (
      material.level_no !== null &&
      material.level_no !== undefined
    ) {
      parts.push(`Kat ${material.level_no}`)
    }

    if (
      material.bin_no !== null &&
      material.bin_no !== undefined
    ) {
      parts.push(`Göz ${material.bin_no}`)
    }

    return parts.join(' / ')
  }

  useEffect(() => {
    const load = async () => {
      /*
       * Ana kayıtları materials tablosundan alıyoruz.
       */
      const { data: materialsData, error: materialsError } =
        await supabase
          .from('materials')
          .select('*')
          .order('created_at', { ascending: false })

      if (materialsError) {
        console.error(materialsError)
        return
      }

      /*
       * materials_view içindeki shelf_code bilgisini de alıyoruz.
       * Böylece eski sistemde raf kodu view üzerinden geliyorsa
       * onu da kaybetmiyoruz.
       */
      const { data: viewData, error: viewError } =
        await supabase
          .from('materials_view')
          .select('*')

      if (viewError) {
        console.warn(
          'materials_view okunamadı:',
          viewError.message,
        )
      }

      const materialList =
        (materialsData as Material[]) ?? []

      const viewList =
        (viewData as Material[]) ?? []

      /*
       * materials + materials_view birleştiriliyor.
       *
       * materials tablosundaki bilgiler esas alınır.
       * shelf_code boşsa materials_view içindeki shelf_code
       * kullanılır.
       */
      const viewMap = new Map(
        viewList.map((item) => [
          item.id,
          item,
        ]),
      )

      const list = materialList.map((material) => {
        const viewMaterial = viewMap.get(material.id)

        return {
          ...material,

          shelf_code:
            material.shelf_code ||
            viewMaterial?.shelf_code ||
            '',
        }
      })

      setRows(list)

      /*
       * URL'den ?numune=ARGE-2026-0002 gibi geldiyse
       * ilgili numuneyi otomatik seç.
       */
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
          `${m.name} ${m.sample_no} ${m.lot_no} ${m.supplier} ${getShelfCode(m)}`
            .toLocaleLowerCase('tr')
            .includes(term),
      ),
    [rows, term],
  )

  /*
   * Sadece bir etiket seçiyoruz.
   */
  const chosen = rows.filter((m) =>
    selected.includes(m.id),
  )

  const current = chosen[0] ?? null

  const selectMaterial = (id: string) => {
    setSelected([id])
    setEditing(false)
  }

  /*
   * Düzenleme ekranını aç
   */
  const startEdit = () => {
    if (!current) return

    setEditName(current.name ?? '')
    setEditSupplier(current.supplier ?? '')
    setEditArrivalDate(current.arrival_date ?? '')

    setEditInitialQuantity(
      String(current.initial_quantity ?? ''),
    )

    setEditUnit(current.unit ?? '')

    setEditShelfCode(
      getShelfCode(current),
    )

    setEditing(true)
  }

  /*
   * Düzenlemeyi iptal et
   */
  const cancelEdit = () => {
    setEditing(false)
  }

  /*
   * Değişiklikleri kaydet
   */
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
        initial_quantity:
          Number(editInitialQuantity),
        unit: editUnit.trim(),
        shelf_code: editShelfCode.trim(),
      })
      .eq('id', current.id)

    if (error) {
      console.error(error)

      alert(
        `Değişiklik kaydedilemedi: ${error.message}`,
      )

      return
    }

    const updated: Material = {
      ...current,

      name: editName.trim(),

      supplier:
        editSupplier.trim(),

      arrival_date:
        editArrivalDate,

      initial_quantity:
        Number(editInitialQuantity),

      unit:
        editUnit.trim(),

      shelf_code:
        editShelfCode.trim(),
    }

    setRows((prev) =>
      prev.map((m) =>
        m.id === current.id
          ? updated
          : m,
      ),
    )

    setEditing(false)

    alert('Etiket bilgileri güncellendi.')
  }

  /*
   * Tarihi Türkçe göster
   */
  const formatDate = (value: string) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString('tr-TR')
  }

  /*
   * Etikette gösterilecek raf
   */
  const currentShelfCode =
    current
      ? getShelfCode(current)
      : ''

  return (
    <>
      {/* =====================================================
          ÜST MENÜ
      ====================================================== */}

      <div className="page-head no-print">

        <div>

          <h1>
            QR Etiketleri
          </h1>

          <p>
            Bir numune seçin. Etiket A4 kağıdının
            ortasına yaklaşık A6 boyutunda tek adet
            olarak yazdırılır.
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
                onClick={() =>
                  window.print()
                }
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


      {/* =====================================================
          ARAMA / NUMUNE SEÇME
      ====================================================== */}

      <div className="card mb no-print">

        <div className="card-b">

          <div className="row mb">

            <div
              className="field search-wide"
              style={{
                margin: 0,
              }}
            >

              <label>
                Ara
              </label>

              <input
                value={q}
                onChange={(e) =>
                  setQ(e.target.value)
                }
                placeholder="Hammadde, numune, lot veya raf"
              />

            </div>


            <button
              onClick={() => {

                if (
                  filtered.length > 0
                ) {
                  setSelected([
                    filtered[0].id,
                  ])
                }

              }}
            >
              İlk numuneyi seç
            </button>


            <button
              onClick={() =>
                setSelected([])
              }
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

                  <th>
                    Numune
                  </th>

                  <th>
                    Hammadde
                  </th>

                  <th>
                    Lot
                  </th>

                  <th>
                    Raf
                  </th>

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
                        selected.includes(
                          m.id,
                        )
                          ? 'rgba(0,0,0,0.05)'
                          : undefined,
                    }}
                  >

                    <td>

                      <input
                        type="radio"
                        readOnly
                        checked={selected.includes(
                          m.id,
                        )}
                        style={{
                          width: 16,
                        }}
                      />

                    </td>


                    <td className="mono">
                      {m.sample_no}
                    </td>


                    <td>
                      {m.name}
                    </td>


                    <td className="mono">
                      {m.lot_no}
                    </td>


                    <td>

                      <span className="chip">

                        {getShelfCode(m) ||
                          '-'}

                      </span>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>


          <p className="small muted mt">

            {current
              ? `Seçilen numune: ${current.sample_no}`
              : 'Henüz numune seçilmedi.'}

          </p>

        </div>

      </div>


      {/* =====================================================
          DÜZENLEME ALANI
      ====================================================== */}

      {editing && current && (

        <div className="card mb no-print">

          <div className="card-b">

            <h3>
              Etiket Bilgilerini Düzenle
            </h3>


            <div
              style={{
                display: 'grid',

                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',

                gap: 16,
              }}
            >

              {/* HAMMADDE ADI */}

              <div className="field">

                <label>
                  Hammadde adı *
                </label>

                <input
                  value={editName}
                  onChange={(e) =>
                    setEditName(
                      e.target.value,
                    )
                  }
                />

              </div>


              {/* FİRMA */}

              <div className="field">

                <label>
                  Firma / tedarikçi *
                </label>

                <input
                  value={editSupplier}
                  onChange={(e) =>
                    setEditSupplier(
                      e.target.value,
                    )
                  }
                />

              </div>


              {/* GELİŞ TARİHİ */}

              <div className="field">

                <label>
                  Geliş tarihi *
                </label>

                <input
                  type="date"
                  value={
                    editArrivalDate
                  }
                  onChange={(e) =>
                    setEditArrivalDate(
                      e.target.value,
                    )
                  }
                />

              </div>


              {/* GELEN MİKTAR */}

              <div className="field">

                <label>
                  Gelen miktar *
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={
                    editInitialQuantity
                  }
                  onChange={(e) =>
                    setEditInitialQuantity(
                      e.target.value,
                    )
                  }
                />

              </div>


              {/* BİRİM */}

              <div className="field">

                <label>
                  Birim *
                </label>

                <input
                  value={editUnit}
                  onChange={(e) =>
                    setEditUnit(
                      e.target.value,
                    )
                  }
                  placeholder="kg, L, adet..."
                />

              </div>


              {/* RAF KODU */}

              <div className="field">

                <label>
                  Raf kodu
                </label>

                <input
                  value={editShelfCode}
                  onChange={(e) =>
                    setEditShelfCode(
                      e.target.value,
                    )
                  }
                  placeholder="Örn: A-01-02"
                />

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          A4 ÜZERİNDE TEK A6 ETİKET
      ====================================================== */}

      {current && (

        <div className="print-page">

          <div className="single-label">


            {/* QR */}

            <div className="label-qr">

              <QrImage
                sampleNo={
                  current.sample_no
                }
                size={280}
              />

            </div>


            {/* QR ALTINDA NUMUNE */}

            <div className="label-sample">

              {current.sample_no}

            </div>


            {/* BAŞLIK */}

            <div className="label-title">

              AR-GE HAMMADDE

            </div>


            {/* HAMMADDE ADI */}

            <div className="label-name">

              {editing
                ? editName
                : current.name}

            </div>


            {/* =================================================
                BİLGİLER
            ================================================== */}

            <div className="label-info">


              {/* HAMMADDE ADI */}

              <div>

                <span>
                  Hammadde adı
                </span>

                <strong>
                  {editing
                    ? editName
                    : current.name}
                </strong>

              </div>


              {/* FİRMA / TEDARİKÇİ */}

              <div>

                <span>
                  Firma / tedarikçi
                </span>

                <strong>
                  {editing
                    ? editSupplier
                    : current.supplier}
                </strong>

              </div>


              {/* GELİŞ TARİHİ */}

              <div>

                <span>
                  Geliş tarihi
                </span>

                <strong>
                  {editing
                    ? formatDate(
                        editArrivalDate,
                      )
                    : formatDate(
                        current.arrival_date,
                      )}
                </strong>

              </div>


              {/* GELEN MİKTAR */}

              <div>

                <span>
                  Gelen miktar
                </span>

                <strong>

                  {editing
                    ? editInitialQuantity
                    : current.initial_quantity}

                  {' '}

                  {editing
                    ? editUnit
                    : current.unit}

                </strong>

              </div>


              {/* BİRİM */}

              <div>

                <span>
                  Birim
                </span>

                <strong>
                  {editing
                    ? editUnit
                    : current.unit}
                </strong>

              </div>


              {/* =================================================
                  RAF KODU
              ================================================== */}

              <div className="label-shelf">

                <span>
                  Raf kodu
                </span>

                <strong>

                  {editing
                    ? editShelfCode ||
                      '-'
                    : currentShelfCode ||
                      '-'}

                </strong>

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          SEÇİM YOK
      ====================================================== */}

      {!current && (

        <div className="card no-print">

          <div className="empty">

            <strong>
              Etiket seçilmedi
            </strong>

            Yukarıdaki listeden bir
            numune seçin.

          </div>

        </div>

      )}


      {/* =====================================================
          STİLLER
      ====================================================== */}

      <style>{`

        .print-page {

          width: 210mm;
          height: 297mm;

          margin: 20px auto;

          display: flex;

          align-items: center;
          justify-content: center;

          background: white;

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

          background: white;

          color: #111;

          overflow: hidden;

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

          font-weight: 800;

          letter-spacing: 0.4mm;

          margin-bottom: 4mm;

          text-align: center;

        }


        .label-title {

          width: 100%;

          text-align: center;

          font-size: 5mm;

          font-weight: 800;

          letter-spacing: 0.5mm;

          border-bottom: 1px solid #111;

          padding-bottom: 2mm;

        }


        .label-name {

          width: 100%;

          text-align: center;

          font-size: 6mm;

          font-weight: 800;

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

          min-height: 5mm;

        }


        .label-info span {

          font-weight: 700;

          flex-shrink: 0;

        }


        .label-info strong {

          font-family: monospace;

          font-size: 4mm;

          text-align: right;

          word-break: break-word;

          max-width: 58%;

        }


        /*
         * RAF KODU
         * Daha belirgin görünmesi için ayrı stil.
         */

        .label-shelf {

          border-top: 1px solid #111;

          padding-top: 3mm;

          margin-top: 1mm;

        }


        .label-shelf strong {

          font-size: 4.5mm;

          font-weight: 900;

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
