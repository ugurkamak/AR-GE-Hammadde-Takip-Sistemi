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

  const selectMaterial = (id: string) => {
    setSelected([id])
    setEditing(false)
  }

  const startEdit = () => {
    if (!current) return

    setEditName(current.name ?? '')
    setEditSupplier(current.supplier ?? '')
    setEditArrivalDate(current.arrival_date ?? '')
    setEditInitialQuantity(
      String(current.initial_quantity ?? ''),
    )
    setEditUnit(current.unit ?? '')
    setEditShelfCode(current.shelf_code ?? '')

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
