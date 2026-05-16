import { useState } from 'react'
import { getExportar, getMetricas } from '../api'
import InfoBanner from '../components/InfoBanner'

export default function Reporte() {
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const downloadExcel = async () => {
    setLoading(true); setError(null); setSuccess(null)
    try {
      const res = await getExportar()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'cryptoops_resultado.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
      setSuccess('Excel descargado correctamente')
    } catch {
      setError('No hay datos para exportar. Carga el Excel primero desde el Dashboard.')
    } finally { setLoading(false) }
  }

  const downloadPDF = async () => {
    setPdfLoading(true); setError(null); setSuccess(null)
    try {
      const res = await getMetricas()
      const m = res.data
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>CryptoOps Engine — Reporte Ejecutivo</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
          h1{color:#1e40af;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:6px}
          h2{color:#374151;margin-top:28px;margin-bottom:10px;font-size:15px;text-transform:uppercase;letter-spacing:1px}
          table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
          th{background:#1e40af;color:white;padding:9px 12px;text-align:left}
          td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
          tr:nth-child(even) td{background:#f8fafc}
          .ok{color:#16a34a;font-weight:bold}
          .bad{color:#dc2626;font-weight:bold}
          .meta{color:#6b7280;font-size:11px}
          .alert-box{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-top:16px}
          .info-box{background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:12px;margin-top:8px;font-size:12px}
        </style>
      </head><body>
        <h1>CryptoOps Engine — Reporte Ejecutivo</h1>
        <p class="meta">Generado: ${new Date().toLocaleString('es-BO')} | Banexcoin Bolivia · Hackathon 2026</p>
        <p class="meta" style="margin-top:4px;color:#dc2626">⚠ Los datos son ficticios, generados solo para fines demostrativos del Hackathon.</p>

        <h2>Resumen de conciliación</h2>
        <div class="info-box">
          Este reporte cruza los registros S-001 (Pago QR) y S-002 (Cobro QR) del sistema Banexcoin
          contra los extractos bancarios, usando el número de transacción como llave de enlace.
        </div>
        <table>
          <tr><th>Métrica</th><th>Valor</th><th>Descripción</th></tr>
          <tr><td>Total analizadas</td><td>${m.total_transacciones?.toLocaleString()}</td><td>S-001 + S-002 procesadas</td></tr>
          <tr><td>Conciliadas</td><td class="ok">${m.conciliadas?.toLocaleString()}</td><td>Coinciden número y monto con el banco</td></tr>
          <tr><td>Discrepancia de monto</td><td class="bad">${m.discrepancias?.toLocaleString()}</td><td>Número coincide pero monto es diferente</td></tr>
          <tr><td>Solo en sistema QR</td><td class="bad">${m.solo_en_qr?.toLocaleString()}</td><td>No aparecen en el extracto bancario</td></tr>
          <tr><td>Solo en banco</td><td class="bad">${m.solo_en_banco?.toLocaleString()}</td><td>No están registradas en el sistema</td></tr>
          <tr><td><strong>Tasa de conciliación</strong></td><td><strong>${m.tasa_conciliacion}%</strong></td><td>del total de transacciones</td></tr>
        </table>

        ${(m.discrepancias + m.solo_en_qr + m.solo_en_banco) > 0 ? `
        <div class="alert-box">
          <strong>⚠ ${(m.discrepancias + m.solo_en_qr + m.solo_en_banco).toLocaleString()} transacciones requieren revisión manual</strong><br>
          <span style="font-size:12px">Ver detalle en la pantalla de Conciliación, filtrando por "Discrepancia" o "Solo en QR".</span>
        </div>` : ''}

        <h2>Volúmenes operativos</h2>
        <table>
          <tr><th>Servicio</th><th>Monto total</th><th>Moneda</th><th>Efecto en saldo</th></tr>
          <tr><td>S-004 Depósitos</td><td>${m.total_usdt_depositado?.toLocaleString('es-BO',{minimumFractionDigits:4})}</td><td>USDT</td><td class="ok">↑ Aumenta saldo</td></tr>
          <tr><td>S-003 Retiros</td><td>${m.total_usdt_retirado?.toLocaleString('es-BO',{minimumFractionDigits:4})}</td><td>USDT</td><td class="bad">↓ Disminuye saldo</td></tr>
          <tr><td>S-001 Pagos QR</td><td>${m.total_bob_pagos?.toLocaleString('es-BO',{minimumFractionDigits:2})}</td><td>BOB</td><td class="bad">↓ Disminuye saldo</td></tr>
          <tr><td>S-002 Cobros QR</td><td>${m.total_bob_cobros?.toLocaleString('es-BO',{minimumFractionDigits:2})}</td><td>BOB</td><td class="ok">↑ Aumenta saldo</td></tr>
        </table>

        <p class="meta" style="margin-top:40px;border-top:1px solid #e5e7eb;padding-top:12px">
          CryptoOps Engine v1.0 · Desafío 1 · Hackathon Banexcoin Bolivia 2026<br>
          Datos ficticios generados únicamente para fines demostrativos.
        </p>
      </body></html>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      setTimeout(() => { win?.print(); window.URL.revokeObjectURL(url) }, 600)
      setSuccess('PDF listo para imprimir')
    } catch {
      setError('No hay datos para exportar. Carga el Excel primero desde el Dashboard.')
    } finally { setPdfLoading(false) }
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Exportar reporte</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Descarga los resultados de conciliación para compartir con el equipo contable
        </p>
      </div>

      <InfoBanner>
        <strong style={{ color: '#f1f5f9' }}>¿Qué incluye cada formato?</strong><br />
        El <strong>Excel</strong> contiene el detalle completo fila por fila (útil para el equipo que va a investigar cada alerta).
        El <strong>PDF</strong> es un resumen ejecutivo con los totales y la tasa de conciliación (útil para presentar a gerencia).
      </InfoBanner>

      {error && (
        <div style={{ background: '#7f1d1d33', border: '1px solid #ef444433', borderRadius: 8, padding: 14, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#14532d33', border: '1px solid #22c55e33', borderRadius: 8, padding: 14, color: '#86efac', fontSize: 13 }}>
          ✓ {success}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Excel */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Detalle completo en Excel</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>3 hojas: Conciliación pagos · Conciliación cobros · Saldos por cliente</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Ideal para que el equipo contable investigue cada alerta fila por fila</div>
          </div>
          <button onClick={downloadExcel} disabled={loading} style={btnStyle(loading, '#16a34a')}>
            {loading ? 'Generando...' : '↓ Descargar Excel'}
          </button>
        </div>

        {/* PDF */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Resumen ejecutivo PDF</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Métricas clave, totales operativos y alertas detectadas</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Ideal para presentar el estado de conciliación a gerencia</div>
          </div>
          <button onClick={downloadPDF} disabled={pdfLoading} style={btnStyle(pdfLoading, '#7c3aed')}>
            {pdfLoading ? 'Generando...' : '↓ Generar PDF'}
          </button>
        </div>
      </div>

      {/* Nota datos ficticios */}
      <div style={{ background: '#292524', border: '1px solid #57534e', borderRadius: 8, padding: 12, color: '#a8a29e', fontSize: 12 }}>
        <strong>Nota:</strong> Los datos procesados son ficticios y fueron generados únicamente para fines demostrativos en el marco del Hackathon Banexcoin Bolivia 2026. No corresponden a operaciones reales ni clientes reales.
      </div>
    </div>
  )
}

function btnStyle(disabled, color) {
  return {
    background: disabled ? '#374151' : color, color: 'white', border: 'none',
    borderRadius: 8, padding: '10px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
  }
}
