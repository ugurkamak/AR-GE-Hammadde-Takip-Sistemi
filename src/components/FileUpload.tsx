import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FILE_CATEGORIES } from '../lib/constants'

export default function FileUpload({
  materialId,
  testResultId,
  onUploaded,
}: {
  materialId: string
  testResultId?: string | null
  onUploaded?: () => void
}) {
  const { session } = useAuth()
  const [category, setCategory] = useState('TDS')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const upload = async (file: File) => {
    setBusy(true)
    setErr('')
    try {
      const path = `${materialId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('material-files').upload(path, file)
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('attachments').insert({
        material_id: materialId,
        test_result_id: testResultId ?? null,
        category,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: session!.user.id,
      })
      if (dbErr) throw dbErr
      onUploaded?.()
    } catch (e: any) {
      setErr(e.message ?? 'Dosya yuklenemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="row">
        <div className="field" style={{ margin: 0 }}>
          <label>Dosya turu</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {FILE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Dosya sec</label>
          <input
            type="file"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {busy && <p className="small muted">Yukleniyor…</p>}
    </div>
  )
}
