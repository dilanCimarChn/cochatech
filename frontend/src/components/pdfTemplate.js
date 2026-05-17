export function buildPdfHtml(m) {
  const alertas   = (m.discrepancias || 0) + (m.solo_en_qr || 0) + (m.solo_en_banco || 0)
  const tasa      = m.tasa_conciliacion || 0
  const tasaColor = tasa >= 80 ? '#16a34a' : tasa >= 50 ? '#d97706' : '#dc2626'
  const tasaLabel = tasa >= 80 ? 'Nivel aceptable' : tasa >= 50 ? 'Requiere atención' : 'Acción inmediata requerida'
  const now       = new Date()
  const fecha     = now.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
  const hora      = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  const f = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d })
  const pct = (x) => m.total_transacciones > 0 ? ((x / m.total_transacciones) * 100).toFixed(1) : '0.0'
  const balBob  = (m.total_bob_cobros  || 0) - (m.total_bob_pagos    || 0)
  const balUsdt = (m.total_usdt_depositado || 0) - (m.total_usdt_retirado || 0)

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Reporte de Conciliación — Banexcoin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page {
  size: letter;
  margin: 12mm 15mm;
}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px;line-height:1.4}
.header{background:linear-gradient(135deg,#1e3a8a,#1e40af);color:white;padding:24px 30px 18px;border-radius:6px;margin-bottom:20px}
.header-row{display:flex;justify-content:space-between;align-items:flex-start}
.brand{font-size:22px;font-weight:900;letter-spacing:-0.5px}
.brand span{color:#93c5fd}
.header-meta{text-align:right;font-size:11px;color:#bfdbfe;line-height:1.9}
.doc-title{margin-top:14px;font-size:13px;font-weight:600;color:#dbeafe;text-transform:uppercase;letter-spacing:1px}
.body{padding:0}
.section{margin-bottom:24px;page-break-inside:avoid;break-inside:avoid}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;page-break-inside:avoid;break-inside:avoid}
.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;border-top:4px solid #e2e8f0}
.kpi-val{font-size:26px;font-weight:900;line-height:1.1;margin-bottom:3px}
.kpi-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.kpi-sub{font-size:10px;color:#94a3b8;margin-top:2px}
.bar-wrap{background:#f1f5f9;border-radius:99px;height:12px;overflow:hidden;margin:10px 0 4px}
.bar-fill{height:100%;border-radius:99px}
.bar-labels{display:flex;justify-content:space-between;font-size:10px;color:#64748b}
table{width:100%;border-collapse:collapse;font-size:12px;page-break-inside:avoid;break-inside:avoid}
thead th{background:#f8fafc;color:#374151;font-weight:700;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0}
tbody td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tbody tr{page-break-inside:avoid;break-inside:avoid}
tbody tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700}
.b-ok{background:#dcfce7;color:#15803d}
.b-bad{background:#fee2e2;color:#b91c1c}
.b-warn{background:#fef9c3;color:#a16207}
.b-info{background:#dbeafe;color:#1d4ed8}
.num-ok{color:#16a34a;font-weight:700;font-size:14px}
.num-bad{color:#dc2626;font-weight:700;font-size:14px}
.alert-box{border-left:4px solid #dc2626;background:#fef2f2;padding:12px 14px;border-radius:0 6px 6px 0;margin-top:12px;page-break-inside:avoid;break-inside:avoid}
.alert-box b{color:#991b1b;display:block;margin-bottom:5px}
.alert-box .det{color:#7f1d1d;font-size:11px;line-height:1.8}
.ok-box{border-left:4px solid #16a34a;background:#f0fdf4;padding:12px 14px;border-radius:0 6px 6px 0;margin-top:12px;page-break-inside:avoid;break-inside:avoid}
.ok-box b{color:#166534}
.cur-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;page-break-inside:avoid;break-inside:avoid}
.cur-card{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid;break-inside:avoid}
.cur-head{padding:9px 14px;font-weight:700;font-size:12px}
.cur-head.bob{background:#eff6ff;color:#1d4ed8}
.cur-head.usdt{background:#f0fdf4;color:#15803d}
.cur-body{padding:10px 14px}
.cur-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9}
.cur-row:last-child{border-bottom:none}
.cur-lbl{color:#64748b;font-size:11px}
.cur-sub{font-size:10px;color:#94a3b8;margin-top:1px}
.cur-val{font-weight:700;font-size:12px}
.glos{display:grid;grid-template-columns:1fr 1fr;gap:8px;page-break-inside:avoid;break-inside:avoid}
.glos-item{border-left:3px solid #e2e8f0;padding:7px 10px;border-radius:0 5px 5px 0;background:#f8fafc;page-break-inside:avoid;break-inside:avoid}
.glos-term{font-weight:700;font-size:11px;margin-bottom:2px}
.glos-def{font-size:10px;color:#64748b;line-height:1.5}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;color:#94a3b8;font-size:10px;page-break-inside:avoid;break-inside:avoid}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header { background: linear-gradient(135deg,#1e3a8a,#1e40af) !important; color: white !important; }
}
</style></head><body>

<div class="header">
  <div class="header-row">
    <div>
      <div class="brand">Crypto<span>Ops</span> Engine</div>
      <div style="font-size:11px;color:#93c5fd;margin-top:2px">Sistema de Conciliación Automática · Banexcoin Bolivia</div>
    </div>
    <div class="header-meta">
      <div><b>Fecha:</b> ${fecha}</div>
      <div><b>Hora:</b> ${hora}</div>
      <div><b>Clasificación:</b> Uso interno</div>
    </div>
  </div>
  <div class="doc-title">Reporte Ejecutivo de Conciliación</div>
</div>

<div class="body">

  <!-- 1. KPIs -->
  <div class="section">
    <div class="section-title">Resumen ejecutivo</div>
    <div class="kpi-grid">
      <div class="kpi" style="border-top-color:#3b82f6">
        <div class="kpi-val" style="color:#1d4ed8">${f(m.total_transacciones)}</div>
        <div class="kpi-label">Transacciones revisadas</div>
        <div class="kpi-sub">Pagos QR (S-001) + Cobros QR (S-002)</div>
      </div>
      <div class="kpi" style="border-top-color:#16a34a">
        <div class="kpi-val" style="color:#16a34a">${f(m.conciliadas)}</div>
        <div class="kpi-label">Conciliadas correctamente</div>
        <div class="kpi-sub">Número y monto coinciden con el banco</div>
      </div>
      <div class="kpi" style="border-top-color:${alertas > 0 ? '#dc2626' : '#16a34a'}">
        <div class="kpi-val" style="color:${alertas > 0 ? '#dc2626' : '#16a34a'}">${f(alertas)}</div>
        <div class="kpi-label">Alertas pendientes</div>
        <div class="kpi-sub">${alertas > 0 ? 'Requieren revisión manual' : 'Sin alertas'}</div>
      </div>
      <div class="kpi" style="border-top-color:${tasaColor}">
        <div class="kpi-val" style="color:${tasaColor}">${tasa}%</div>
        <div class="kpi-label">Tasa de conciliación</div>
        <div class="kpi-sub">${tasaLabel}</div>
      </div>
    </div>
    <div style="margin-top:14px">
      <div style="font-size:10px;color:#64748b;font-weight:600;margin-bottom:5px">
        Progreso — ${f(m.conciliadas)} de ${f(m.total_transacciones)} transacciones verificadas
      </div>
      <div class="bar-wrap"><div class="bar-fill" style="width:${Math.min(tasa,100)}%;background:${tasaColor}"></div></div>
      <div class="bar-labels"><span>0%</span><span style="color:${tasaColor};font-weight:700">${tasa}%</span><span>100%</span></div>
    </div>
  </div>

  <!-- 2. Detalle de conciliación -->
  <div class="section">
    <div class="section-title">Detalle por estado de conciliación</div>
    <table>
      <thead>
        <tr><th>Estado</th><th>Cantidad</th><th>% del total</th><th>¿Qué significa?</th><th>¿Qué hacer?</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge b-ok">✅ CONCILIADO</span></td>
          <td class="num-ok">${f(m.conciliadas)}</td>
          <td>${pct(m.conciliadas)}%</td>
          <td>El número de transacción y el monto coinciden exactamente entre el sistema Banexcoin y el extracto bancario.</td>
          <td style="color:#15803d;font-size:11px">Ninguna acción requerida.</td>
        </tr>
        <tr>
          <td><span class="badge b-bad">⚠ DISCREPANCIA</span></td>
          <td class="num-bad">${f(m.discrepancias)}</td>
          <td>${pct(m.discrepancias)}%</td>
          <td>El número de transacción existe en ambos sistemas, pero los montos registrados son diferentes.</td>
          <td style="color:#b91c1c;font-size:11px">Verificar el monto correcto y corregir el registro.</td>
        </tr>
        <tr>
          <td><span class="badge b-warn">🟡 SOLO EN QR</span></td>
          <td class="num-bad">${f(m.solo_en_qr)}</td>
          <td>${pct(m.solo_en_qr)}%</td>
          <td>La transacción fue registrada en Banexcoin pero no aparece en el extracto bancario.</td>
          <td style="color:#b91c1c;font-size:11px">Confirmar si el banco procesó el pago. Revisar si el extracto está completo.</td>
        </tr>
        <tr>
          <td><span class="badge b-info">🔵 SOLO EN BANCO</span></td>
          <td class="num-bad">${f(m.solo_en_banco)}</td>
          <td>${pct(m.solo_en_banco)}%</td>
          <td>El banco registró una operación que no existe en el sistema QR de Banexcoin.</td>
          <td style="color:#b91c1c;font-size:11px">Identificar la transacción y registrarla si corresponde.</td>
        </tr>
      </tbody>
    </table>
    ${alertas > 0
      ? `<div class="alert-box"><b>⚠ ${f(alertas)} transacciones requieren revisión manual</b>
           <div class="det">
             ${m.discrepancias > 0 ? '• ' + f(m.discrepancias) + ' con diferencia de monto — verificar importes<br>' : ''}
             ${m.solo_en_qr    > 0 ? '• ' + f(m.solo_en_qr)    + ' sin respaldo bancario — confirmar con el banco<br>' : ''}
             ${m.solo_en_banco > 0 ? '• ' + f(m.solo_en_banco) + ' no registradas en el sistema — revisar origen' : ''}
           </div></div>`
      : `<div class="ok-box"><b>✅ Conciliación perfecta — No se detectaron diferencias entre el sistema y el banco.</b></div>`
    }
  </div>

  <!-- 3. Volúmenes -->
  <div class="section">
    <div class="section-title">Volúmenes operativos del periodo</div>
    <div class="cur-grid">
      <div class="cur-card">
        <div class="cur-head bob">💵 Operaciones en Bolivianos (BOB)</div>
        <div class="cur-body">
          <div class="cur-row">
            <div><div class="cur-lbl">S-001 · Pagos QR</div><div class="cur-sub">Pagos realizados por clientes mediante código QR</div></div>
            <div class="cur-val" style="color:#dc2626">↓ ${f(m.total_bob_pagos, 2)} BOB</div>
          </div>
          <div class="cur-row">
            <div><div class="cur-lbl">S-002 · Cobros QR</div><div class="cur-sub">Cobros recibidos por clientes mediante código QR</div></div>
            <div class="cur-val" style="color:#16a34a">↑ ${f(m.total_bob_cobros, 2)} BOB</div>
          </div>
          <div class="cur-row" style="background:#f8fafc;padding:7px 4px;border-radius:5px">
            <div style="font-weight:700;font-size:11px">Balance neto BOB</div>
            <div class="cur-val" style="color:${balBob >= 0 ? '#16a34a' : '#dc2626'}">${balBob >= 0 ? '+' : ''}${f(balBob, 2)} BOB</div>
          </div>
        </div>
      </div>
      <div class="cur-card">
        <div class="cur-head usdt">🪙 Operaciones en USDT (Activos digitales)</div>
        <div class="cur-body">
          <div class="cur-row">
            <div><div class="cur-lbl">S-004 · Depósitos USDT</div><div class="cur-sub">Entradas de USDT recibidas por clientes vía blockchain</div></div>
            <div class="cur-val" style="color:#16a34a">↑ ${f(m.total_usdt_depositado, 4)} USDT</div>
          </div>
          <div class="cur-row">
            <div><div class="cur-lbl">S-003 · Retiros USDT</div><div class="cur-sub">Salidas de USDT enviadas a los clientes</div></div>
            <div class="cur-val" style="color:#dc2626">↓ ${f(m.total_usdt_retirado, 4)} USDT</div>
          </div>
          <div class="cur-row" style="background:#f8fafc;padding:7px 4px;border-radius:5px">
            <div style="font-weight:700;font-size:11px">Balance neto USDT</div>
            <div class="cur-val" style="color:${balUsdt >= 0 ? '#16a34a' : '#dc2626'}">${balUsdt >= 0 ? '+' : ''}${f(balUsdt, 4)} USDT</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 4. Glosario -->
  <div class="section">
    <div class="section-title">Glosario — ¿qué significa cada término?</div>
    <div class="glos">
      <div class="glos-item" style="border-left-color:#3b82f6">
        <div class="glos-term">Conciliación</div>
        <div class="glos-def">Proceso de verificar que los registros del sistema coincidan con los del banco. Si coinciden, la operación está "conciliada".</div>
      </div>
      <div class="glos-item" style="border-left-color:#16a34a">
        <div class="glos-term">Tasa de conciliación</div>
        <div class="glos-def">Porcentaje de transacciones que cuadran correctamente. Lo ideal es estar por encima del 95%.</div>
      </div>
      <div class="glos-item" style="border-left-color:#dc2626">
        <div class="glos-term">Discrepancia de monto</div>
        <div class="glos-def">La transacción existe en ambos sistemas pero los montos son diferentes. Puede indicar un error de registro o un ajuste bancario.</div>
      </div>
      <div class="glos-item" style="border-left-color:#f59e0b">
        <div class="glos-term">Solo en QR / Solo en banco</div>
        <div class="glos-def">La transacción aparece en solo uno de los dos sistemas. Puede ser un error de carga, operación pendiente o no registrada.</div>
      </div>
      <div class="glos-item" style="border-left-color:#a78bfa">
        <div class="glos-term">USDT (Tether)</div>
        <div class="glos-def">Criptomoneda estable equivalente a 1 dólar estadounidense. Se usa para depósitos y retiros en el sistema cripto.</div>
      </div>
      <div class="glos-item" style="border-left-color:#34d399">
        <div class="glos-term">BOB (Boliviano)</div>
        <div class="glos-def">Moneda nacional de Bolivia. Se usa en pagos y cobros QR procesados a través de la red bancaria local.</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>CryptoOps Engine v1.0 · Banexcoin Bolivia</div>
    <div>Generado el ${fecha} a las ${hora}</div>
  </div>
</div>
</body></html>`
}
