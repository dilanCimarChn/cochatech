import { useEffect, useState } from 'react'
import TransactionTable from '../components/TransactionTable'
import InfoBanner from '../components/InfoBanner'
import { getConciliacion } from '../api'

const ESTADOS = ['', 'CONCILIADO', 'DISCREPANCIA', 'SOLO_EN_QR', 'SOLO_EN_BANCO']
const TIPOS = ['', 'pago', 'cobro']

const ESTADO_INFO = {
  '': null,
  CONCILIADO:    { color: '#22c55e', label: 'Conciliado',       desc: 'El número de transacción aparece en el sistema QR y en el banco, y el monto es igual.' },
  DISCREPANCIA:  { color: '#ef4444', label: 'Discrepancia',     desc: 'El número aparece en ambos lados pero el monto registrado es diferente.' },
  SOLO_EN_QR:    { color: '#f59e0b', label: 'Solo en QR',       desc: 'El número existe en el sistema Banexcoin pero no aparece en el extracto bancario.' },
  SOLO_EN_BANCO: { color: '#3b82f6', label: 'Solo en Banco',    desc: 'El número aparece en el extracto bancario pero no está registrado en el sistema Banexcoin.' },
}

const COLS = [
  { key: 'nro', label: '#', nowrap: true },
  { key: 'transaccion_id', label: 'Nro. Transacción', nowrap: true },
  {
    key: 'tipo',
    label: 'Tipo',
    render: (val) => {
      const map = { pago: { label: 'S-001 Pago QR', color: '#ef4444' }, cobro: { label: 'S-002 Cobro QR', color: '#22c55e' } }
      const m = map[val] || { label: val, color: '#94a3b8' }
      return <span style={{ color: m.color, fontWeight: 600, fontSize: 12 }}>{m.label}</span>
    },
  },
  { key: 'estado', label: 'Estado' },
  {
    key: 'monto_qr',
    label: 'Monto en sistema (BOB)',
    render: (val) => val != null ? Number(val).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—',
  },
  {
    key: 'monto_banco',
    label: 'Monto en banco (BOB)',
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
  { key: 'fecha', label: 'Fecha' },
]

export default function Conciliacion() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState('')
  const [tipo, setTipo] = useState('')

  const load = (pg = 1) => {
    setLoading(true)
    const params = { page: pg, page_size: 20 }
    if (estado) params.estado = estado
    if (tipo) params.tipo = tipo
    getConciliacion(params)
      .then((r) => { setData(r.data.data); setTotal(r.data.total); setPages(r.data.pages); setPage(pg); setError(null) })
      .catch((e) => setError(e.response?.data?.detail || 'Error cargando datos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [estado, tipo])

  const estadoInfo = ESTADO_INFO[estado]

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Conciliación de transacciones</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Cruce del sistema Banexcoin contra el extracto bancario — {total.toLocaleString()} registros
        </p>
      </div>

      {/* Explicación del proceso */}
      <InfoBanner>
        <strong style={{ color: '#f1f5f9' }}>¿Cómo funciona esta pantalla?</strong><br />
        Cada pago <strong>(S-001)</strong> y cobro <strong>(S-002)</strong> registrado en Banexcoin tiene un número de transacción
        que debería aparecer también en el extracto bancario. Esta tabla muestra si coinciden o no, y señala las diferencias.
        Usa los filtros para ver solo las alertas que necesitan revisión.
      </InfoBanner>

      {/* Leyenda de estados */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(ESTADO_INFO).filter(([k]) => k !== '').map(([key, info]) => (
          <button
            key={key}
            onClick={() => setEstado(estado === key ? '' : key)}
            style={{
              background: estado === key ? info.color + '22' : '#1e293b',
              border: `1px solid ${estado === key ? info.color : '#334155'}`,
              borderRadius: 8,
              padding: '6px 12px',
              color: estado === key ? info.color : '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: estado === key ? 700 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
            {info.label}
          </button>
        ))}
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={selectStyle}>
          <option value="">Todos los tipos</option>
          <option value="pago">S-001 Pago QR</option>
          <option value="cobro">S-002 Cobro QR</option>
        </select>
      </div>

      {/* Descripción del filtro activo */}
      {estadoInfo && (
        <div style={{
          background: estadoInfo.color + '15',
          border: `1px solid ${estadoInfo.color}44`,
          borderRadius: 8,
          padding: '10px 16px',
          color: estadoInfo.color,
          fontSize: 13,
        }}>
          <strong>{estadoInfo.label}:</strong> {estadoInfo.desc}
        </div>
      )}

      {error && (
        <div style={{ color: '#fca5a5', background: '#7f1d1d33', padding: 14, borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cargando transacciones...</div>}

      {!loading && (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <TransactionTable columns={COLS} data={data} page={page} pages={pages} onPageChange={(pg) => load(pg)} />
        </div>
      )}
    </div>
  )
}

const selectStyle = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', outline: 'none',
}
