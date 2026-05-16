import { useEffect, useState } from 'react'
import TransactionTable from '../components/TransactionTable'
import { getConciliacionPagos } from '../api'

const ESTADOS = ['', 'CONCILIADO', 'DISCREPANCIA', 'SOLO_EN_QR', 'SOLO_EN_BANCO']

const ESTADO_INFO = {
  CONCILIADO:    { color: '#22c55e', label: 'Conciliado' },
  DISCREPANCIA:  { color: '#ef4444', label: 'Discrepancia' },
  SOLO_EN_QR:    { color: '#f59e0b', label: 'Solo en QR' },
  SOLO_EN_BANCO: { color: '#3b82f6', label: 'Solo en Banco' },
}

const COLS = [
  { key: 'nro', label: '#', nowrap: true },
  { key: 'transaccion_id', label: 'Nro. Transacción', nowrap: true },
  { key: 'estado', label: 'Estado' },
  {
    key: 'monto_qr',
    label: 'Monto sistema (BOB)',
    render: (val) => val != null ? Number(val).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'monto_banco',
    label: 'Monto banco (BOB)',
    render: (val) => val != null ? Number(val).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'diferencia',
    label: 'Diferencia',
    render: (val) => {
      if (val === null || val === undefined) return '—'
      const n = Number(val)
      const color = Math.abs(n) < 0.01 ? '#22c55e' : '#ef4444'
      return <span style={{ color, fontWeight: 600 }}>{n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
    },
  },
  { key: 'fecha', label: 'Fecha', nowrap: true },
]

export default function ConciliacionPagos() {
  const [data, setData]   = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState('')

  const load = (pg = 1) => {
    setLoading(true)
    const params = { page: pg, page_size: 20 }
    if (estado) params.estado = estado
    getConciliacionPagos(params)
      .then((r) => { setData(r.data.data); setTotal(r.data.total); setPages(r.data.pages); setPage(pg); setError(null) })
      .catch((e) => setError(e.response?.data?.detail || 'Error cargando datos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [estado])

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>S-001</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Conciliación — Pagos QR</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Pagos QR del sistema Banexcoin vs extracto bancario — {total.toLocaleString()} registros
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(ESTADO_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setEstado(estado === key ? '' : key)}
            style={{
              background: estado === key ? info.color + '22' : '#1e293b',
              border: `1px solid ${estado === key ? info.color : '#334155'}`,
              borderRadius: 8, padding: '6px 14px',
              color: estado === key ? info.color : '#94a3b8',
              cursor: 'pointer', fontSize: 12, fontWeight: estado === key ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
            {info.label}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#fca5a5', background: '#7f1d1d33', padding: 14, borderRadius: 8, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cargando...</div>}

      {!loading && (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <TransactionTable columns={COLS} data={data} page={page} pages={pages} onPageChange={(pg) => load(pg)} />
        </div>
      )}
    </div>
  )
}
