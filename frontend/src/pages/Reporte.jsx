import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts'
import { getExportar, getMetricas } from '../api'
import { buildPdfHtml } from '../components/pdfTemplate'


const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

function fmt(n, dec = 0) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// Tarjeta KPI pequeña
function KPI({ label, value, sub, color = '#3b82f6', big = false }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 12, padding: big ? '20px 24px' : '16px 20px',
      borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color: '#f1f5f9', fontSize: big ? 28 : 22, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

// Barra de progreso
function ProgressBar({ pct, color }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: 99, height: 10, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  )
}

// Sección con título
function Section({ title, icon, children }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

export default function Reporte() {
  const [m, setM] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dlLoading, setDlLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    getMetricas()
      .then(r => setM(r.data))
      .catch(() => setError('No hay datos. Carga un archivo desde el Dashboard primero.'))
      .finally(() => setLoading(false))
  }, [])

  const downloadExcel = async () => {
    setDlLoading(true); setError(null); setSuccess(null)
    try {
      const res = await getExportar()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = 'cryptoops_resultado.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
      setSuccess('✓ Excel descargado correctamente')
    } catch { setError('Error al descargar. Intenta nuevamente.') }
    finally { setDlLoading(false) }
  }

  const downloadPDF = async () => {
    if (!m) return
    setPdfLoading(true); setError(null); setSuccess(null)
    const html = buildPdfHtml(m)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = window.URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    setTimeout(() => { win?.print(); window.URL.revokeObjectURL(url) }, 700)
    setSuccess('✓ PDF listo para imprimir')
    setPdfLoading(false)
  }

  const alertas = m ? (m.discrepancias || 0) + (m.solo_en_qr || 0) + (m.solo_en_banco || 0) : 0

  const pieData = m ? [
    { name: 'Conciliadas',         value: m.conciliadas    || 0 },
    { name: 'Discrepancia monto',  value: m.discrepancias  || 0 },
    { name: 'Solo en QR',          value: m.solo_en_qr     || 0 },
    { name: 'Solo en banco',       value: m.solo_en_banco  || 0 },
  ].filter(d => d.value > 0) : []

  const barDataBOB = m ? [
    { name: 'Pagos QR\n(S-001)', valor: m.total_bob_pagos  || 0, fill: '#ef4444' },
    { name: 'Cobros QR\n(S-002)', valor: m.total_bob_cobros || 0, fill: '#22c55e' },
  ] : []

  const barDataUSDT = m ? [
    { name: 'Depósitos\n(S-004)', valor: m.total_usdt_depositado || 0, fill: '#34d399' },
    { name: 'Retiros\n(S-003)',   valor: m.total_usdt_retirado   || 0, fill: '#f59e0b' },
  ] : []

  const radialData = m ? [{ name: 'Tasa', value: m.tasa_conciliacion || 0, fill: m.tasa_conciliacion >= 80 ? '#22c55e' : m.tasa_conciliacion >= 50 ? '#f59e0b' : '#ef4444' }] : []

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Reporte de Conciliación</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Resumen visual del estado actual · Descarga el detalle en Excel o PDF
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={downloadExcel} disabled={dlLoading || !m} style={btnStyle(dlLoading || !m, '#16a34a')}>
            {dlLoading ? '⏳ Generando...' : '📥 Descargar Excel'}
          </button>
          <button onClick={downloadPDF} disabled={pdfLoading || !m} style={btnStyle(pdfLoading || !m, '#7c3aed')}>
            {pdfLoading ? '⏳ Generando...' : '📄 Generar PDF'}
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && <div style={{ background: '#7f1d1d33', border: '1px solid #ef444433', borderRadius: 8, padding: 14, color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: '#14532d33', border: '1px solid #22c55e33', borderRadius: 8, padding: 14, color: '#86efac', fontSize: 13 }}>{success}</div>}

      {loading && <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>Cargando datos...</div>}

      {m && (
        <>
          {/* ── KPIs principales ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <KPI label="Total analizadas"    value={fmt(m.total_transacciones)} sub="S-001 + S-002"         color="#3b82f6" />
            <KPI label="Conciliadas"         value={fmt(m.conciliadas)}         sub="Coinciden con el banco" color="#22c55e" />
            <KPI label="Alertas detectadas"  value={fmt(alertas)}               sub="Requieren revisión"     color={alertas > 0 ? '#ef4444' : '#22c55e'} />
            <KPI label="Tasa de conciliación" value={`${m.tasa_conciliacion}%`} sub="del total procesado"   color="#a78bfa" big />
          </div>

          {/* ── Banner de alertas / éxito ── */}
          {alertas > 0 ? (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                ⚠ {fmt(alertas)} transacciones necesitan revisión
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {m.discrepancias > 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>🔴 {fmt(m.discrepancias)} discrepancias de monto</span>}
                {m.solo_en_qr    > 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>🟡 {fmt(m.solo_en_qr)} solo en sistema QR</span>}
                {m.solo_en_banco > 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>🔵 {fmt(m.solo_en_banco)} solo en banco</span>}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '16px 20px', color: '#86efac', fontWeight: 700 }}>
              ✅ Conciliación perfecta — no se detectaron diferencias
            </div>
          )}

          {/* ── Fila de gráficas superiores ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Pie de conciliación */}
            <Section title="Estado de conciliación" icon="⚖️">
              <div style={{ color: '#64748b', fontSize: 12 }}>¿Cuántas transacciones QR cuadran con el banco?</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [fmt(v) + ' transacciones', n]}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={10}
                    formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            {/* Radial de tasa */}
            <Section title="Tasa de conciliación" icon="🎯">
              <div style={{ color: '#64748b', fontSize: 12 }}>Porcentaje de operaciones que cuadran correctamente</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="85%"
                    startAngle={180} endAngle={-180} data={radialData}>
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#0f172a' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', marginTop: -12 }}>
                  <div style={{ fontSize: 42, fontWeight: 900, color: radialData[0]?.fill || '#22c55e' }}>
                    {m.tasa_conciliacion}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {m.tasa_conciliacion >= 80 ? '✅ Nivel aceptable' : m.tasa_conciliacion >= 50 ? '⚠ Nivel intermedio' : '🔴 Nivel crítico'}
                  </div>
                </div>
                <ProgressBar pct={m.tasa_conciliacion} color={radialData[0]?.fill || '#22c55e'} />
              </div>
            </Section>
          </div>

          {/* ── Volúmenes operativos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <Section title="Volumen en BOB" icon="💵">
              <div style={{ color: '#64748b', fontSize: 12 }}>Pagos y cobros QR en bolivianos</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barDataBOB} margin={{ top: 4, right: 4, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={v => [fmt(v, 2) + ' BOB', 'Monto']}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {barDataBOB.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #334155' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Pagos QR: <strong style={{ color: '#ef4444' }}>{fmt(m.total_bob_pagos, 2)} BOB</strong></span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Cobros QR: <strong style={{ color: '#22c55e' }}>{fmt(m.total_bob_cobros, 2)} BOB</strong></span>
              </div>
            </Section>

            <Section title="Volumen en USDT" icon="🪙">
              <div style={{ color: '#64748b', fontSize: 12 }}>Depósitos y retiros de activos digitales</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barDataUSDT} margin={{ top: 4, right: 4, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={v => [fmt(v, 4) + ' USDT', 'Monto']}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {barDataUSDT.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #334155' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Depósitos: <strong style={{ color: '#34d399' }}>{fmt(m.total_usdt_depositado, 2)} USDT</strong></span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Retiros: <strong style={{ color: '#f59e0b' }}>{fmt(m.total_usdt_retirado, 2)} USDT</strong></span>
              </div>
            </Section>
          </div>

          {/* ── Detalle de estados (texto) ── */}
          <Section title="Guía de estados — ¿qué significa cada color?" icon="📖">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { color: '#22c55e', label: 'CONCILIADO', qty: m.conciliadas, desc: 'Número y monto coinciden exactamente con el extracto bancario. No requiere acción.' },
                { color: '#ef4444', label: 'DISCREPANCIA', qty: m.discrepancias, desc: 'El número de transacción existe en ambos lados pero los montos son diferentes.' },
                { color: '#f59e0b', label: 'SOLO EN QR', qty: m.solo_en_qr, desc: 'El registro está en el sistema Banexcoin pero no aparece en el extracto del banco.' },
                { color: '#3b82f6', label: 'SOLO EN BANCO', qty: m.solo_en_banco, desc: 'El banco registró la operación pero no existe en el sistema QR.' },
              ].map(({ color, label, qty, desc }) => (
                <div key={label} style={{ background: '#0f172a', borderRadius: 10, padding: 14, borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{label}</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 18 }}>{fmt(qty)}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Nota */}
          <div style={{ background: '#292524', border: '1px solid #57534e', borderRadius: 8, padding: 12, color: '#a8a29e', fontSize: 12 }}>
            <strong>Nota:</strong> Los datos son ficticios, generados únicamente para fines demostrativos del Hackathon Banexcoin Bolivia 2026.
          </div>
        </>
      )}
    </div>
  )
}

function btnStyle(disabled, color) {
  return {
    background: disabled ? '#374151' : color, color: 'white', border: 'none',
    borderRadius: 8, padding: '10px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
    boxShadow: disabled ? 'none' : `0 4px 12px ${color}55`,
    transition: 'all 0.2s',
  }
}
