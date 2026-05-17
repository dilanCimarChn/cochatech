import { useState, useMemo } from 'react'

const STEP_COLOR = ['#3b82f6', '#a78bfa', '#f59e0b', '#22c55e']

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const SHEET_LABELS = {
  'Depositos':          { label: 'Depósitos (S-004)',          desc: 'Entradas de USDT por cliente',           icon: '📥' },
  'Depósitos':          { label: 'Depósitos (S-004)',          desc: 'Entradas de USDT por cliente',           icon: '📥' },
  'Retiros':            { label: 'Retiros (S-003)',            desc: 'Salidas de USDT',                        icon: '📤' },
  'Pago QR':            { label: 'Pagos QR (S-001)',           desc: 'Pagos en BOB con QR',                    icon: '📲' },
  'Cobro QR':           { label: 'Cobros QR (S-002)',          desc: 'Cobros en BOB con QR',                   icon: '💳' },
  'Transfers':          { label: 'Transferencias (S-005)',     desc: 'Transferencias entre clientes',          icon: '🔁' },
  'Saldos':             { label: 'Saldos',                     desc: 'Saldo final por cliente',                icon: '💰' },
  'EXTRACTO DE PAGOS':  { label: 'Extracto Bancario — Pagos', desc: 'Extracto del banco para pagos',          icon: '🏦' },
  'EXTRACTO DE COBROS': { label: 'Extracto Bancario — Cobros',desc: 'Extracto del banco para cobros',         icon: '🏦' },
}

function getSheetMeta(name) {
  return SHEET_LABELS[name] || { label: name, desc: 'Hoja personalizada', icon: '📋' }
}

// ── Paso 1: Selección de hojas ────────────────────────────────────────────────
function StepSelectSheets({ sheets, selected, onToggle }) {
  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
        Selecciona las tablas que quieres incluir en el análisis.
        Las hojas del banco (extractos) son necesarias para la conciliación QR.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sheets.map((sheet) => {
          const meta   = getSheetMeta(sheet.name)
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
              <span style={{ fontSize: 24 }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: active ? '#93c5fd' : '#e2e8f0', fontWeight: 600, fontSize: 16 }}>
                  {meta.label}
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>
                  {meta.desc} — {sheet.total_rows} filas · {sheet.columns.length} columnas
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

// ── Paso 2: Selección de columnas por hoja ────────────────────────────────────
function StepSelectColumns({ sheets, selected, colSelection, onToggleCol, onSelectAll, onClearAll }) {
  const [activeSheet, setActiveSheet] = useState(selected[0] || null)
  const sheet = sheets.find(s => s.name === activeSheet)
  const activeCols = colSelection[activeSheet] || []

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 14 }}>
        Elige qué columnas de cada tabla quieres enviar al análisis.
        Puedes deseleccionar las que no necesitas para simplificar el procesamiento.
      </p>

      {/* Tabs de hojas */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {selected.map(name => {
          const meta      = getSheetMeta(name)
          const cols      = colSelection[name] || []
          const total     = sheets.find(s => s.name === name)?.columns.length || 0
          const isActive  = activeSheet === name
          return (
            <button
              key={name}
              onClick={() => setActiveSheet(name)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: isActive ? '#a78bfa' : '#1e293b',
                color: isActive ? 'white' : '#94a3b8',
                border: isActive ? 'none' : '1px solid #334155',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {meta.icon} {meta.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : '#334155',
                borderRadius: 99, padding: '0 6px', fontSize: 12, marginLeft: 2,
              }}>
                {cols.length}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {sheet && (
        <div>
          {/* Acciones rápidas */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              {activeCols.length} de {sheet.columns.length} columnas seleccionadas
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onSelectAll(activeSheet, sheet.columns)}
                style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}
              >
                Todas
              </button>
              <button
                onClick={() => onClearAll(activeSheet)}
                style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}
              >
                Ninguna
              </button>
            </div>
          </div>

          {/* Grid de columnas con checkbox */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16,
            maxHeight: 200, overflowY: 'auto', paddingRight: 4,
          }}>
            {sheet.columns.map(col => {
              const isSelected = activeCols.includes(col)
              return (
                <button
                  key={col}
                  onClick={() => onToggleCol(activeSheet, col)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isSelected ? 'rgba(167,139,250,0.1)' : '#0f172a',
                    border: isSelected ? '1px solid #a78bfa' : '1px solid #1e293b',
                    borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.12s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: isSelected ? '#a78bfa' : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid #475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                  }}>
                    {isSelected && <CheckIcon />}
                  </div>
                  <span style={{
                    color: isSelected ? '#e2e8f0' : '#64748b',
                    fontSize: 14, fontFamily: 'monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Vista previa filtrada */}
          {activeCols.length > 0 && sheet.sample.length > 0 && (
            <>
              <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Vista previa con columnas seleccionadas
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e293b', maxHeight: 160 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      {activeCols.slice(0, 8).map(col => (
                        <th key={col} style={{ padding: '7px 10px', textAlign: 'left', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #1e293b', fontFamily: 'monospace', fontSize: 13 }}>
                          {col}
                        </th>
                      ))}
                      {activeCols.length > 8 && <th style={{ padding: '7px 10px', color: '#475569', borderBottom: '1px solid #1e293b' }}>+{activeCols.length - 8} más</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.sample.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                        {activeCols.slice(0, 8).map(col => (
                          <td key={col} style={{ padding: '6px 10px', color: '#94a3b8', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(row[col] ?? '—')}
                          </td>
                        ))}
                        {activeCols.length > 8 && <td style={{ padding: '6px 10px', color: '#475569' }}>…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeCols.length === 0 && (
            <div style={{ color: '#f59e0b', fontSize: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
              ⚠ Selecciona al menos una columna para esta hoja
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Paso 3: Confirmación ──────────────────────────────────────────────────────
function StepConfirm({ sheets, selected, colSelection, filename }) {
  const totalRows = sheets
    .filter(s => selected.includes(s.name))
    .reduce((acc, s) => acc + (s.total_rows || 0), 0)

  const totalCols = Object.values(colSelection).reduce((acc, cols) => acc + cols.length, 0)

  return (
    <div style={{ textAlign: 'center', paddingTop: 10 }}>
      <div style={{ fontSize: 54, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
        ¡Todo listo para procesar!
      </div>
      <div style={{ color: '#64748b', fontSize: 15, marginBottom: 20 }}>
        Se analizarán{' '}
        <strong style={{ color: '#93c5fd' }}>{selected.length} tablas</strong>,{' '}
        <strong style={{ color: '#93c5fd' }}>{totalCols} columnas</strong> y{' '}
        <strong style={{ color: '#93c5fd' }}>{totalRows.toLocaleString()} filas
        </strong>
      </div>

      <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 20px', textAlign: 'left', border: '1px solid #1e293b' }}>
        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          Resumen de selección
        </div>
        {selected.map(name => {
          const meta  = getSheetMeta(name)
          const sheet = sheets.find(s => s.name === name)
          const cols  = colSelection[name] || []
          return (
            <div key={name} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15, flex: 1 }}>{meta.label}</span>
                <span style={{ color: '#64748b', fontSize: 14 }}>{sheet?.total_rows?.toLocaleString()} filas</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 26 }}>
                {cols.slice(0, 8).map(c => (
                  <span key={c} style={{ background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontFamily: 'monospace' }}>
                    {c}
                  </span>
                ))}
                {cols.length > 8 && (
                  <span style={{ color: '#475569', fontSize: 12, padding: '2px 4px' }}>+{cols.length - 8} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, color: '#475569', fontSize: 14 }}>
        📄 Archivo: <span style={{ color: '#94a3b8' }}>{filename}</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ExcelOnboarding({ previewData, originalFile, onConfirm, onCancel, uploading }) {
  const { sheets, filename } = previewData

  const knownNames     = Object.keys(SHEET_LABELS)
  const defaultSelected = sheets
    .filter(s => knownNames.some(k => k.toLowerCase() === s.name.toLowerCase()))
    .map(s => s.name)

  const [step, setStep]       = useState(0)
  const [selected, setSelected] = useState(
    defaultSelected.length > 0 ? defaultSelected : sheets.map(s => s.name)
  )

  // colSelection: { [sheetName]: string[] }  — columnas activas por hoja
  const [colSelection, setColSelection] = useState(() => {
    const init = {}
    sheets.forEach(s => { init[s.name] = [...s.columns] })
    return init
  })

  const steps = ['Seleccionar tablas', 'Elegir columnas', 'Vista previa y confirmar']

  const toggleSheet = (name) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const toggleCol = (sheetName, col) => {
    setColSelection(prev => {
      const current = prev[sheetName] || []
      const next    = current.includes(col) ? current.filter(c => c !== col) : [...current, col]
      return { ...prev, [sheetName]: next }
    })
  }

  const selectAll = (sheetName, allCols) => {
    setColSelection(prev => ({ ...prev, [sheetName]: [...allCols] }))
  }

  const clearAll = (sheetName) => {
    setColSelection(prev => ({ ...prev, [sheetName]: [] }))
  }

  // Bloquear "Siguiente" si alguna hoja seleccionada no tiene columnas
  const colsValid = useMemo(() =>
    selected.every(name => (colSelection[name] || []).length > 0),
  [selected, colSelection])

  const handleConfirm = () => {
    // Filtra solo las hojas seleccionadas con sus columnas elegidas
    const sheetConfig = selected.map(name => ({
      name,
      columns: colSelection[name] || [],
    }))
    onConfirm(sheetConfig)
  }

  const canNext = step === 0 ? selected.length > 0 : colsValid

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 620,
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', border: '1px solid #334155',
        display: 'flex', flexDirection: 'column', maxHeight: '92vh',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: 0 }}>
                Configurar importación
              </h2>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 3 }}>
                Archivo: {filename}
              </p>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 22, padding: 4 }}>✕</button>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {steps.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === step ? STEP_COLOR[i] : i < step ? '#334155' : '#0f172a',
                    border: i < step ? '2px solid #22c55e' : i === step ? 'none' : '2px solid #334155',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: i < step ? '#22c55e' : 'white',
                    transition: 'all 0.2s',
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: i === step ? '#f1f5f9' : '#475569' }}>
                    {label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, margin: '0 10px', background: i < step ? '#22c55e' : '#1e3a5f', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '0 28px', overflowY: 'auto', flex: 1 }}>
          {step === 0 && (
            <StepSelectSheets sheets={sheets} selected={selected} onToggle={toggleSheet} />
          )}
          {step === 1 && (
            <StepSelectColumns
              sheets={sheets}
              selected={selected}
              colSelection={colSelection}
              onToggleCol={toggleCol}
              onSelectAll={selectAll}
              onClearAll={clearAll}
            />
          )}
          {step === 2 && (
            <StepConfirm sheets={sheets} selected={selected} colSelection={colSelection} filename={filename} />
          )}
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
              background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 16,
            }}
          >
            {step === 0 ? 'Cancelar' : '← Atrás'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 0 && selected.length === 0 && (
              <span style={{ color: '#f59e0b', fontSize: 14 }}>Selecciona al menos una tabla</span>
            )}
            {step === 1 && !colsValid && (
              <span style={{ color: '#f59e0b', fontSize: 14 }}>Cada tabla necesita al menos 1 columna</span>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                style={{
                  padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: !canNext ? '#374151' : step === 0 ? '#2563eb' : '#a78bfa',
                  color: 'white', cursor: !canNext ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 16,
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
                  fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8,
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
