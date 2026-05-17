import { useState } from 'react'

// Colores por paso
const STEP_COLOR = ['#3b82f6', '#a78bfa', '#22c55e']

// Íconos SVG simples inline
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// Mapa de hojas conocidas → etiqueta amigable
const SHEET_LABELS = {
  'Depositos': { label: 'Depósitos (S-004)', desc: 'Entradas de USDT por cliente', icon: '📥' },
  'Depósitos': { label: 'Depósitos (S-004)', desc: 'Entradas de USDT por cliente', icon: '📥' },
  'Retiros': { label: 'Retiros (S-003)', desc: 'Salidas de USDT', icon: '📤' },
  'Pago QR': { label: 'Pagos QR (S-001)', desc: 'Pagos en BOB con QR', icon: '📲' },
  'Cobro QR': { label: 'Cobros QR (S-002)', desc: 'Cobros en BOB con QR', icon: '💳' },
  'Transfers': { label: 'Transferencias (S-005)', desc: 'Transferencias entre clientes', icon: '🔁' },
  'Saldos': { label: 'Saldos', desc: 'Saldo final por cliente', icon: '💰' },
  'EXTRACTO DE PAGOS': { label: 'Extracto Bancario — Pagos', desc: 'Extracto del banco para pagos', icon: '🏦' },
  'EXTRACTO DE COBROS': { label: 'Extracto Bancario — Cobros', desc: 'Extracto del banco para cobros', icon: '🏦' },
}

function getSheetMeta(name) {
  return SHEET_LABELS[name] || { label: name, desc: 'Hoja personalizada', icon: '📋' }
}

// ── Paso 1: Selección de hojas ────────────────────────────────────────────────
function StepSelectSheets({ sheets, selected, onToggle }) {
  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Selecciona las tablas que quieres incluir en el análisis.
        Las hojas del banco (extractos) son necesarias para la conciliación QR.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sheets.map((sheet) => {
          const meta = getSheetMeta(sheet.name)
          const active = selected.includes(sheet.name)
          return (
            <button
              key={sheet.name}
              onClick={() => onToggle(sheet.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: active ? 'rgba(59,130,246,0.12)' : '#0f172a',
                border: active ? '1.5px solid #3b82f6' : '1.5px solid #334155',
                borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22 }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: active ? '#93c5fd' : '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                  {meta.label}
                </div>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  {meta.desc} — {sheet.total_rows} filas
                </div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: active ? '#3b82f6' : 'transparent',
                border: active ? 'none' : '2px solid #475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', flexShrink: 0,
              }}>
                {active && <CheckIcon />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Paso 2: Vista previa de columnas ─────────────────────────────────────────
function StepPreviewColumns({ sheets, selected }) {
  const [activeSheet, setActiveSheet] = useState(selected[0] || null)
  const sheet = sheets.find(s => s.name === activeSheet)

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
        Revisa las columnas detectadas en cada tabla. El sistema las usará para la conciliación.
      </p>
      {/* Tabs de hojas */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {selected.map(name => {
          const meta = getSheetMeta(name)
          return (
            <button
              key={name}
              onClick={() => setActiveSheet(name)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeSheet === name ? '#3b82f6' : '#1e293b',
                color: activeSheet === name ? 'white' : '#94a3b8',
                border: activeSheet === name ? 'none' : '1px solid #334155',
              }}
            >
              {meta.icon} {meta.label}
            </button>
          )
        })}
      </div>

      {sheet && (
        <div>
          {/* Columnas como chips */}
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Columnas detectadas ({sheet.columns.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {sheet.columns.map(col => (
              <span key={col} style={{
                background: '#1e3a5f', color: '#93c5fd', padding: '4px 10px',
                borderRadius: 20, fontSize: 12, border: '1px solid #1d4ed8',
              }}>
                {col}
              </span>
            ))}
          </div>

          {/* Muestra de filas */}
          {sheet.sample.length > 0 && (
            <>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Primeras filas de ejemplo
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      {sheet.columns.slice(0, 6).map(col => (
                        <th key={col} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #1e293b' }}>
                          {col}
                        </th>
                      ))}
                      {sheet.columns.length > 6 && <th style={{ padding: '8px 12px', color: '#475569', borderBottom: '1px solid #1e293b' }}>…</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.sample.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                        {sheet.columns.slice(0, 6).map(col => (
                          <td key={col} style={{ padding: '7px 12px', color: '#94a3b8', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(row[col] || '—')}
                          </td>
                        ))}
                        {sheet.columns.length > 6 && <td style={{ padding: '7px 12px', color: '#475569' }}>…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Paso 3: Confirmación ──────────────────────────────────────────────────────
function StepConfirm({ sheets, selected, filename }) {
  const totalRows = sheets
    .filter(s => selected.includes(s.name))
    .reduce((acc, s) => acc + (s.total_rows || 0), 0)

  return (
    <div style={{ textAlign: 'center', paddingTop: 10 }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
        ¡Todo listo para procesar!
      </div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
        Se analizarán <strong style={{ color: '#93c5fd' }}>{selected.length} tablas</strong> con un total de{' '}
        <strong style={{ color: '#93c5fd' }}>{totalRows.toLocaleString()} filas</strong>
      </div>
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 20px', textAlign: 'left', border: '1px solid #1e293b' }}>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Tablas seleccionadas
        </div>
        {selected.map(name => {
          const meta = getSheetMeta(name)
          const sheet = sheets.find(s => s.name === name)
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#e2e8f0', fontSize: 13 }}>
              <span>{meta.icon}</span>
              <span style={{ flex: 1 }}>{meta.label}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>{sheet?.total_rows?.toLocaleString()} filas</span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 16, color: '#475569', fontSize: 12 }}>
        📄 Archivo: <span style={{ color: '#94a3b8' }}>{filename}</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ExcelOnboarding({ previewData, originalFile, onConfirm, onCancel, uploading }) {
  const { sheets, filename } = previewData

  // Pre-seleccionar todas las hojas conocidas
  const knownNames = Object.keys(SHEET_LABELS)
  const defaultSelected = sheets
    .filter(s => knownNames.some(k => k.toLowerCase() === s.name.toLowerCase()))
    .map(s => s.name)

  const [step, setStep] = useState(0) // 0, 1, 2
  const [selected, setSelected] = useState(defaultSelected.length > 0 ? defaultSelected : sheets.map(s => s.name))

  const steps = ['Seleccionar tablas', 'Revisar columnas', 'Confirmar y procesar']

  const toggleSheet = (name) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handleConfirm = () => {
    onConfirm(selected)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 580,
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', border: '1px solid #334155',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>
                Configurar importación
              </h2>
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                Archivo: {filename}
              </p>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
          </div>

          {/* Steps indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {steps.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === step ? STEP_COLOR[i] : i < step ? '#334155' : '#0f172a',
                    border: i < step ? '2px solid #22c55e' : i === step ? 'none' : '2px solid #334155',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: i < step ? '#22c55e' : 'white',
                    transition: 'all 0.2s',
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    color: i === step ? '#f1f5f9' : '#475569',
                  }}>
                    {label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, margin: '0 10px',
                    background: i < step ? '#22c55e' : '#1e3a5f',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '0 28px', overflowY: 'auto', flex: 1 }}>
          {step === 0 && <StepSelectSheets sheets={sheets} selected={selected} onToggle={toggleSheet} />}
          {step === 1 && <StepPreviewColumns sheets={sheets} selected={selected} />}
          {step === 2 && <StepConfirm sheets={sheets} selected={selected} filename={filename} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid #334155', flexShrink: 0, marginTop: 16,
        }}>
          <button
            onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
            style={{
              padding: '9px 20px', borderRadius: 8, border: '1px solid #334155',
              background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            {step === 0 ? 'Cancelar' : '← Atrás'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected.length === 0 && step === 0 && (
              <span style={{ color: '#f59e0b', fontSize: 12 }}>Selecciona al menos una tabla</span>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={selected.length === 0}
                style={{
                  padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: selected.length === 0 ? '#374151' : '#2563eb',
                  color: 'white', cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 14,
                }}
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={uploading}
                style={{
                  padding: '9px 28px', borderRadius: 8, border: 'none',
                  background: uploading ? '#374151' : '#16a34a',
                  color: 'white', cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {uploading ? '⏳ Procesando...' : '🚀 Iniciar análisis'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
