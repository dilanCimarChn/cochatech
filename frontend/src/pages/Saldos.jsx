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

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Saldos por cliente</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Saldo USDT calculado vs saldo real reportado — {total.toLocaleString()} clientes
        </p>
      </div>

      <InfoBanner>
        <strong style={{ color: '#f1f5f9' }}>¿Cómo se calcula el saldo USDT?</strong>
        <div style={{ display: 'flex', gap: 28, marginTop: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#34d399', fontWeight: 600, marginBottom: 4 }}>Suma (entradas USDT)</div>
            <div>+ S-004 Depósitos (crypto_quantity)</div>
            <div>+ S-005 Banextransfer recibidas</div>
          </div>
          <div>
            <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 4 }}>Resta (salidas USDT)</div>
            <div>− S-003 Retiros (crypto_quantity + fee)</div>
            <div>− S-005 Banextransfer enviadas</div>
          </div>
          <div style={{ borderLeft: '1px solid #334155', paddingLeft: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>S-001 y S-002 son en BOB</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>No afectan el saldo USDT</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Se concilian en la pestaña anterior</div>
          </div>
        </div>
      </InfoBanner>

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
          <option value="CONCILIADO">Solo los que cuadran ✓</option>
          <option value="DISCREPANCIA">Solo las alertas ⚠</option>
        </select>
      </div>

      {error && <div style={{ color: '#fca5a5', background: '#7f1d1d33', padding: 12, borderRadius: 8, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cargando saldos...</div>}

      {!loading && (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Cuenta ID</th>
                  <th style={th}>Nombre</th>
                  <th style={{ ...th, color: '#34d399' }} title="S-004 Depósitos">Depósitos USDT</th>
                  <th style={{ ...th, color: '#f87171' }} title="S-003 Retiros">Retiros USDT</th>
                  <th style={{ ...th, color: '#a78bfa' }} title="S-005 Banextransfer neto">Transfers neto</th>
                  <th style={{ ...th, color: '#f59e0b' }}>Saldo calculado</th>
                  <th style={th}>Saldo real</th>
                  <th style={th}>Diferencia</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Sin resultados</td></tr>
                ) : data.map((row, i) => {
                  const disc = Math.abs(row.diferencia) >= 0.0001
                  return (
                    <tr key={i} style={{ background: disc ? '#7f1d1d15' : 'transparent' }}>
                      <td style={{ ...td, color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{row.account_id || '—'}</td>
                      <td style={td}>{row.account_name || '—'}</td>
                      <td style={{ ...td, color: '#34d399', textAlign: 'right' }}>{fmt(row.depositos_usdt)}</td>
                      <td style={{ ...td, color: '#f87171', textAlign: 'right' }}>{fmt(row.retiros_usdt)}</td>
                      <td style={{ ...td, color: '#a78bfa', textAlign: 'right' }}>{fmt(row.transfers_neto)}</td>
                      <td style={{ ...td, color: '#f59e0b', fontWeight: 600, textAlign: 'right' }}>{fmt(row.saldo_calculado)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(row.saldo_real)}</td>
                      <td style={{ ...td, color: disc ? '#fca5a5' : '#86efac', fontWeight: 700, textAlign: 'right' }}>
                        {disc ? '⚠ ' : '✓ '}{fmt(row.diferencia)}
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

const th = { padding: '10px 14px', textAlign: 'left', background: '#0f172a', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }
const td = { padding: '8px 14px', borderBottom: '1px solid #0f172a', color: '#e2e8f0' }
const selectStyle = { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', outline: 'none' }
const paginBtn = (d) => ({ background: d ? '#1e293b' : '#2563eb', color: d ? '#64748b' : 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: d ? 'not-allowed' : 'pointer', fontSize: 13 })
