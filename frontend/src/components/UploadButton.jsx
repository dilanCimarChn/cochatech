import { useRef, useState } from 'react'
import { uploadExcel } from '../api'

export default function UploadButton({ onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef()

  const handle = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await uploadExcel(file)
      onSuccess?.(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        onClick={() => ref.current?.click()}
        disabled={loading}
        style={{
          background: loading ? '#374151' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '10px 20px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {loading ? 'Procesando...' : 'Cargar Excel'}
      </button>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" onChange={handle} style={{ display: 'none' }} />
      {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}
    </div>
  )
}
