import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import MetricCard from '../components/MetricCard'
import UploadButton from '../components/UploadButton'
import ServiceLegend from '../components/ServiceLegend'
import { getMetricas } from '../api'

const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

function fmtNum(n, dec = 0) {
  if (n === undefined || n === null) return '—'
  return Number(n).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function Dashboard({ onUploadSuccess }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    getMetricas()
      .then((r) => { setData(r.data); setError(null) })
      .catch((e) => setError(e.response?.data?.detail || 'No hay datos cargados. Sube el Excel para comenzar.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const pieData = data
    ? [
        { name: 'Conciliadas', value: data.conciliadas },
        { name: 'Discrepancias de monto', value: data.discrepancias },
        { name: 'Solo en QR (sin match banco)', value: data.solo_en_qr },
        { name: 'Solo en Banco (sin match QR)', value: data.solo_en_banco },
      ].filter((d) => d.value > 0)
    : []

  const barData = data
    ? [
        { name: 'Depósitos\n(S-004)', valor: data.total_usdt_depositado, moneda: 'USDT', fill: '#34d399' },
        { name: 'Retiros\n(S-003)', valor: data.total_usdt_retirado, moneda: 'USDT', fill: '#f59e0b' },
        { name: 'Pagos QR\n(S-001)', valor: data.total_bob_pagos, moneda: 'BOB', fill: '#ef4444' },
        { name: 'Cobros QR\n(S-002)', valor: data.total_bob_cobros, moneda: 'BOB', fill: '#22c55e' },
      ]
    : []

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Dashboard</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            Resumen general de la conciliación — sube el Excel de Banexcoin para comenzar
          </p>
        </div>
        <UploadButton onSuccess={() => { load(); onUploadSuccess?.() }} />
      </div>

      {/* Servicios */}
      <div>
        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Tipos de operación en el Excel
        </div>
        <ServiceLegend />
      </div>

      {loading && <div style={{ color: '#94a3b8' }}>Cargando métricas...</div>}

      {error && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#2563eb22', border: '1px solid #2563eb44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📂</div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 17, marginBottom: 6 }}>Ningún archivo cargado</div>
            <div style={{ fontSize: 13, color: '#64748b', maxWidth: 360 }}>
              Sube el Excel de Banexcoin para que el motor de conciliación procese las operaciones automáticamente.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: '📊', label: 'Excel (.xlsx)', desc: 'Archivo con múltiples hojas' },
              { icon: '📄', label: 'Archivos CSV',  desc: 'Un CSV por tipo de operación' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 20px', textAlign: 'left', minWidth: 160 }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{label}</div>
                <div style={{ color: '#475569', fontSize: 11 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Usa el botón <strong style={{ color: '#3b82f6' }}>Cargar Excel</strong> en la barra lateral o en el encabezado de esta página.
          </div>
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 14 }}>
            <MetricCard
              label="Total transacciones"
              value={fmtNum(data.total_transacciones)}
              sub="S-001 + S-002 analizadas"
              color="#3b82f6"
            />
            <MetricCard
              label="Conciliadas"
              value={fmtNum(data.conciliadas)}
              sub="Coinciden con el banco"
              color="#22c55e"
            />
            <MetricCard
              label="Alertas detectadas"
              value={fmtNum(data.discrepancias + data.solo_en_qr + data.solo_en_banco)}
              sub="Requieren revisión"
              color="#ef4444"
            />
            <MetricCard
              label="Tasa de conciliación"
              value={`${data.tasa_conciliacion}%`}
              sub="del total conciliado"
              color="#a78bfa"
            />
            <MetricCard
              label="USDT depositados"
              value={fmtNum(data.total_usdt_depositado, 2)}
              sub="S-004 Depósitos"
              color="#34d399"
            />
            <MetricCard
              label="BOB en pagos QR"
              value={fmtNum(data.total_bob_pagos, 2)}
              sub="S-001 Pagos QR"
              color="#f87171"
            />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24 }}>
              <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Estado de conciliación</div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                ¿Cuántas transacciones S-001 y S-002 cuadran con el banco?
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={95}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [fmtNum(v) + ' transacciones', name]}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i], display: 'inline-block' }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24 }}>
              <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Volumen por tipo de operación</div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                Montos totales movidos por cada servicio en el periodo
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtNum(v)} />
                  <Tooltip
                    formatter={(v, n, p) => [fmtNum(v, 2) + ' ' + p.payload.moneda, 'Monto total']}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
