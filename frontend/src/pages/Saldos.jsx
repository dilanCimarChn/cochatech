import { useEffect, useState } from 'react'
import { getSaldos } from '../api'
import DiscrepancyBadge from '../components/DiscrepancyBadge'
import InfoBanner from '../components/InfoBanner'

function fmt(n, dec = 4) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function Saldos() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')

  const load = (pg = 1) => {
    setLoading(true)
    const params = { page: pg, page_size: 50 }
    if (buscar) params.buscar = buscar
    if (estado) params.estado = estado
    getSaldos(params)
      .then((r) => { setData(r.data.data); setTotal(r.data.total); setPages(r.data.pages); setPage(pg); setError(null) })
      .catch((e) => setError(e.response?.data?.detail || 'Error cargando saldos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => load(1), 300)
    return () => clearTimeout(t)
  }, [buscar, estado])

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Saldos por cliente</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Verificación de saldo esperado vs saldo real reportado — {total.toLocaleString()} clientes
        </p>
      </div>

      {/* Fórmula explicada */}
      <InfoBanner>
        <strong style={{ color: '#f1f5f9' }}>¿Cómo se calcula el saldo esperado?</strong><br />
        El sistema suma y resta todas las operaciones del cliente para calcular cuánto debería tener, y lo compara contra el saldo que reporta el Excel:
        <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#34d399', marginBottom: 4 }}>Aumenta el saldo</div>
            <div>+ S-004 Depósitos (USDT)</div>
            <div>+ S-002 Cobros QR (BOB)</div>
            <div>+ S-005 Banextransfer recibidas</div>
          </div>
          <div>
            <div style={{ color: '#f87171', marginBottom: 4 }}>Disminuye el saldo</div>
            <div>− S-003 Retiros (USDT)</div>
            <div>− S-001 Pagos QR (BOB)</div>
            <div>− S-005 Banextransfer enviadas</div>
          </div>
          <div>
            <div style={{ color: '#f59e0b', marginBottom: 4 }}>Resultado</div>
            <div>= Saldo esperado</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Si difiere del saldo real → alerta</div>
          </div>
        </div>
      </InfoBanner>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por nombre o ID de cliente..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          style={{
            background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
            borderRadius: 8, padding: '8px 14px', fontSize: 13, outline: 'none', minWidth: 260,
          }}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={selectStyle}>
          <option value="">Todos los clientes</option>
          <option value="CONCILIADO">Solo los que cuadran</option>
          <option value="DISCREPANCIA">Solo los que no cuadran (alertas)</option>
        </select>
      </div>

      {error && <div style={{ color: '#fca5a5', background: '#7f1d1d33', padding: 12, borderRadius: 8, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cargando saldos...</div>}

      {!loading && (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[
                    { label: 'Cuenta ID', tip: null },
                    { label: 'Nombre del cliente', tip: null },
                    { label: 'Saldo calculado', tip: 'Lo que el sistema calcula según sus operaciones' },
                    { label: 'Saldo real', tip: 'Lo que reporta la hoja Saldos del Excel' },
                    { label: 'Diferencia', tip: 'Calculado − Real. En rojo si no cuadra' },
                    { label: 'Estado', tip: null },
                  ].map(({ label, tip }) => (
                    <th key={label} title={tip || ''} style={{
                      padding: '10px 14px', textAlign: 'left', background: '#0f172a',
                      color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #334155',
                      whiteSpace: 'nowrap', cursor: tip ? 'help' : 'default',
                    }}>
                      {label} {tip && <span style={{ color: '#475569', fontSize: 10 }}>ℹ</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Sin resultados</td>
                  </tr>
                ) : data.map((row, i) => {
                  const disc = Math.abs(row.diferencia) >= 0.001
                  return (
                    <tr key={i} style={{ background: disc ? '#7f1d1d15' : 'transparent' }}>
                      <td style={td}><span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{row.account_id || '—'}</span></td>
                      <td style={td}>{row.account_name || '—'}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.saldo_calculado)}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.saldo_real)}</td>
                      <td style={{ ...td, color: disc ? '#fca5a5' : '#86efac', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {disc && '⚠ '}{fmt(row.diferencia)}
                      </td>
                      <td style={td}><DiscrepancyBadge estado={row.estado} /></td>
                    </tr>
                  )
                })}
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
const selectStyle = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', outline: 'none',
}
const paginBtn = (disabled) => ({
  background: disabled ? '#1e293b' : '#2563eb', color: disabled ? '#64748b' : 'white',
  border: 'none', borderRadius: 6, padding: '6px 14px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13,
})
