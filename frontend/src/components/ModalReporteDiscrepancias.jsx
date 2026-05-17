import { useEffect, useState } from 'react'
import { getConciliacionPagos, getConciliacionCobros, getExportarDiscrepancias } from '../api'

const ESTADO_INFO = {
  DISCREPANCIA:  { color: '#ef4444', label: 'Monto distinto' },
  SOLO_EN_QR:    { color: '#f59e0b', label: 'Solo en Sistema' },
  SOLO_EN_BANCO: { color: '#3b82f6', label: 'Solo en Banco' },
}

function Badge({ estado }) {
  const info = ESTADO_INFO[estado] || { color: '#94a3b8', label: estado }
  return (
    <span style={{
      background: info.color + '22', color: info.color,
      border: `1px solid ${info.color}55`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {info.label}
    </span>
  )
}

function fmt(val) {
  if (val == null || val === '') return '—'
  const n = Number(val)
  if (isNaN(n)) return val
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getMotivo(r) {
  if (r.estado === 'DISCREPANCIA')
    return `Monto diferente — Sistema: ${fmt(r.monto_qr)} BOB | Banco: ${fmt(r.monto_banco)} BOB | Diferencia: ${fmt(r.diferencia)} BOB`
  if (r.estado === 'SOLO_EN_QR')
    return 'Transacción en el sistema Banexcoin sin registro en el extracto bancario'
  if (r.estado === 'SOLO_EN_BANCO')
    return 'Movimiento en el extracto bancario sin transacción correspondiente en el sistema'
  return r.estado
}

// ── Detail modal for a single row ──────────────────────────────────────────
export function ModalDetalle({ row, onClose }) {
  const info = ESTADO_INFO[row.estado] || { color: '#94a3b8', label: row.estado }
  const motivo = getMotivo(row)

  const fields = [
    { label: 'Número de Cuenta',   value: row.numero_cuenta || '—' },
    { label: 'Nombre Cliente',     value: row.nombre || '—' },
    { label: 'Nro. Transacción',   value: row.transaccion_id || '—', mono: true },
    { label: 'Fecha',              value: row.fecha || '—' },
    { label: 'Monto Sistema (BOB)', value: row.monto_qr != null ? `${fmt(row.monto_qr)} BOB` : '—' },
    { label: 'Monto Banco (BOB)',  value: row.monto_banco != null ? `${fmt(row.monto_banco)} BOB` : '—' },
    { label: 'Diferencia',         value: row.diferencia != null ? `${fmt(row.diferencia)} BOB` : '—',
      color: row.diferencia != null && Math.abs(Number(row.diferencia)) >= 0.01 ? '#ef4444' : undefined },
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f172a', borderRadius: 14,
          border: `1px solid ${info.color}55`,
          width: 480, maxWidth: '95vw',
          boxShadow: `0 0 40px ${info.color}22`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${info.color}33`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: info.color, display: 'inline-block', flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Detalle de alerta</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{info.label}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', padding: 4 }}
          >✕</button>
        </div>

        {/* Fields */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(({ label, value, mono, color }) => (
            <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, color: '#64748b', width: 160, flexShrink: 0, paddingTop: 2 }}>{label}</div>
              <div style={{
                fontSize: 13, color: color || '#e2e8f0', fontWeight: 500,
                fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all',
              }}>{value}</div>
            </div>
          ))}

          {/* Motivo */}
          <div style={{ marginTop: 4, background: info.color + '11', borderLeft: `3px solid ${info.color}`, borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: info.color, fontWeight: 700, marginBottom: 4 }}>MOTIVO DE LA DISCREPANCIA</div>
            <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>{motivo}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main list modal ─────────────────────────────────────────────────────────
export default function ModalReporteDiscrepancias({ tipo, onClose }) {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [downloading, setDownload] = useState(false)
  const [error, setError]         = useState(null)
  const [detalle, setDetalle]     = useState(null)
  const [buscar, setBuscar]       = useState('')

  useEffect(() => {
    setLoading(true)
    const fn = tipo === 'cobros' ? getConciliacionCobros : getConciliacionPagos
    fn({ page: 1, page_size: 2000 })
      .then((r) => {
        setRows((r.data.data || []).filter((x) => x.estado !== 'CONCILIADO'))
        setError(null)
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false))
  }, [tipo])

  const filtered = buscar.trim()
    ? rows.filter((r) =>
        (r.transaccion_id || '').toLowerCase().includes(buscar.toLowerCase()) ||
        (r.numero_cuenta  || '').toLowerCase().includes(buscar.toLowerCase()) ||
        (r.nombre         || '').toLowerCase().includes(buscar.toLowerCase())
      )
    : rows

  const resumen = {
    total:        rows.length,
    solo_qr:      rows.filter((x) => x.estado === 'SOLO_EN_QR').length,
    solo_banco:   rows.filter((x) => x.estado === 'SOLO_EN_BANCO').length,
    discrepancia: rows.filter((x) => x.estado === 'DISCREPANCIA').length,
    monto_riesgo: rows.reduce((s, r) => s + Math.abs(Number(r.monto_qr || r.monto_banco || 0)), 0),
  }

  const descargar = () => {
    setDownload(true)
    getExportarDiscrepancias(tipo)
      .then((r) => {
        const url  = URL.createObjectURL(new Blob([r.data]))
        const a    = document.createElement('a')
        a.href     = url
        a.download = `discrepancias_${tipo || 'todas'}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Error al descargar el reporte'))
      .finally(() => setDownload(false))
  }

  const titulo = tipo === 'cobros' ? 'Cobros QR' : 'Pagos QR'

  const COLS = [
    { key: 'nro',            label: '#',                  w: 36 },
    { key: 'numero_cuenta',  label: 'Nro. Cuenta',        w: 110 },
    { key: 'nombre',         label: 'Cliente',            w: 140 },
    { key: 'transaccion_id', label: 'Nro. Transacción',   w: 140, mono: true },
    { key: 'estado',         label: 'Estado',             w: 120 },
    { key: 'monto',          label: 'Monto (BOB)',        w: 110 },
    { key: 'fecha',          label: 'Fecha',              w: 110 },
    { key: 'motivo',         label: 'Motivo',             w: undefined },
  ]

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#0f172a', borderRadius: 14,
            border: '1px solid #1e293b',
            width: '96vw', maxWidth: 1100,
            maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid #1e293b',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 2 }}>REPORTE DE ALERTAS</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>Discrepancias — {titulo}</div>
            </div>
            <input
              placeholder="Buscar cuenta, nombre, transacción…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, padding: '7px 12px',
                color: '#e2e8f0', fontSize: 12, width: 240, outline: 'none',
              }}
            />
            <button
              onClick={descargar}
              disabled={downloading || loading || rows.length === 0}
              style={{
                background: downloading ? '#1e293b' : '#22c55e',
                color: downloading ? '#64748b' : '#fff',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                fontWeight: 700, fontSize: 12, cursor: downloading ? 'not-allowed' : 'pointer',
              }}
            >
              {downloading ? 'Descargando…' : '↓ Exportar Excel'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid #334155',
                color: '#94a3b8', borderRadius: 8, padding: '8px 12px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              ✕ Cerrar
            </button>
          </div>

          {/* Summary */}
          {!loading && !error && (
            <div style={{ padding: '12px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #1e293b' }}>
              {[
                { label: 'Total alertas',   val: resumen.total,        color: '#ef4444' },
                { label: 'Solo en Sistema', val: resumen.solo_qr,      color: '#f59e0b' },
                { label: 'Solo en Banco',   val: resumen.solo_banco,   color: '#3b82f6' },
                { label: 'Monto distinto',  val: resumen.discrepancia, color: '#f97316' },
                { label: 'Monto en riesgo', val: `BOB ${resumen.monto_riesgo.toLocaleString('es-BO', { maximumFractionDigits: 0 })}`, color: '#a78bfa' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{
                  background: '#1e293b', borderRadius: 8,
                  padding: '8px 14px', borderLeft: `3px solid ${color}`, flex: '1 1 110px',
                }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 32, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Cargando registros…</div>}
            {error   && <div style={{ padding: 24, color: '#fca5a5', background: '#7f1d1d33', margin: 16, borderRadius: 8, fontSize: 13 }}>{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ padding: 32, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                {buscar ? 'Sin coincidencias.' : 'No se encontraron discrepancias.'}
              </div>
            )}
            {!loading && !error && filtered.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 1 }}>
                    {COLS.map(({ label, w }) => (
                      <th key={label} style={{
                        padding: '9px 10px', textAlign: 'left',
                        color: '#94a3b8', fontWeight: 600, fontSize: 11,
                        borderBottom: '1px solid #334155', whiteSpace: 'nowrap',
                        width: w || undefined, minWidth: w || undefined,
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const monto = r.monto_qr ?? r.monto_banco
                    const motivo = getMotivo(r)
                    return (
                      <tr
                        key={i}
                        onClick={() => setDetalle(r)}
                        style={{
                          background: i % 2 === 0 ? 'transparent' : '#0f172a11',
                          borderBottom: '1px solid #1e293b44',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#1e293b')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#0f172a11')}
                      >
                        <td style={{ padding: '7px 10px', color: '#475569' }}>{i + 1}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>{r.numero_cuenta || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{r.nombre || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#cbd5e1', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.transaccion_id || '—'}</td>
                        <td style={{ padding: '7px 10px' }}><Badge estado={r.estado} /></td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {monto != null ? fmt(monto) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b', maxWidth: 280, lineHeight: 1.4 }}>{motivo}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {detalle && <ModalDetalle row={detalle} onClose={() => setDetalle(null)} />}
    </>
  )
}
