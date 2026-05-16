import { useEffect, useState } from 'react'
import { getSaldosBob } from '../api'

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function SaldosBob() {
  const [data, setData]     = useState([])
  const [totales, setTotales] = useState({})
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [buscar, setBuscar] = useState('')

  const load = (pg = 1) => {
    setLoading(true)
    const params = { page: pg, page_size: 20 }
    if (buscar) params.buscar = buscar
    getSaldosBob(params)
      .then((r) => {
        setData(r.data.data)
        setTotal(r.data.total)
        setPages(r.data.pages)
        setPage(pg)
        setTotales(r.data.totales || {})
        setError(null)
      })
      .catch((e) => setError(e.response?.data?.detail || 'Error cargando saldos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => load(1), 300)
    return () => clearTimeout(t)
  }, [buscar])

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>S-001 / S-002</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Saldo por cliente (BOB)</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          DEBE, HABER y SALDO en bolivianos por cuenta — {total.toLocaleString()} clientes
        </p>
      </div>

      {/* Totales generales */}
      {totales.debe_bob !== undefined && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total DEBE',  valor: totales.debe_bob,  color: '#ef4444' },
            { label: 'Total HABER', valor: totales.haber_bob, color: '#22c55e' },
            { label: 'Saldo Neto',  valor: totales.saldo_bob, color: '#f59e0b' },
          ].map(({ label, valor, color }) => (
            <div key={label} style={{
              background: '#1e293b', borderRadius: 10, padding: '14px 20px',
              borderLeft: `3px solid ${color}`, minWidth: 180,
            }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{fmt(valor)}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>BOB</div>
            </div>
          ))}
        </div>
      )}

      <input
        placeholder="Buscar por cuenta o cliente..."
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        style={{
          background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
          borderRadius: 8, padding: '8px 14px', fontSize: 13, outline: 'none', maxWidth: 320,
        }}
      />

      {error && <div style={{ color: '#fca5a5', background: '#7f1d1d33', padding: 12, borderRadius: 8, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cargando...</div>}

      {!loading && (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[
                    { label: '#',          color: '#94a3b8' },
                    { label: 'Cuenta',     color: '#94a3b8' },
                    { label: 'Cliente',    color: '#94a3b8' },
                    { label: 'DEBE (BOB)', color: '#ef4444' },
                    { label: 'HABER (BOB)',color: '#22c55e' },
                    { label: 'SALDO (BOB)',color: '#f59e0b' },
                  ].map(({ label, color }) => (
                    <th key={label} style={{ padding: '10px 14px', textAlign: label === '#' ? 'center' : 'left', background: '#0f172a', color, fontWeight: 600, borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Sin resultados</td></tr>
                ) : data.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: 'center', color: '#475569' }}>{row.nro}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{row.numero_cuenta || '—'}</td>
                    <td style={td}>{row.cliente || '—'}</td>
                    <td style={{ ...td, color: '#f87171', textAlign: 'right', fontWeight: 600 }}>{fmt(row.debe_bob)}</td>
                    <td style={{ ...td, color: '#34d399', textAlign: 'right', fontWeight: 600 }}>{fmt(row.haber_bob)}</td>
                    <td style={{ ...td, color: '#fbbf24', textAlign: 'right', fontWeight: 700 }}>{fmt(row.saldo_bob)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 16, alignItems: 'center' }}>
              <button onClick={() => load(page - 1)} disabled={page <= 1} style={paginBtn(page <= 1)}>← Anterior</button>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Página {page} de {pages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= pages} style={paginBtn(page >= pages)}>Siguiente →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const td = { padding: '9px 14px', borderBottom: '1px solid #0f172a', color: '#e2e8f0' }
const paginBtn = (d) => ({ background: d ? '#1e293b' : '#2563eb', color: d ? '#64748b' : 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: d ? 'not-allowed' : 'pointer', fontSize: 13 })
