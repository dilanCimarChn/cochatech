import { useState, useRef } from 'react'

// Tipos de hoja disponibles en el sistema
const SHEET_TYPES = [
  { key: 'depositos',       label: 'Depósitos (S-004)',             icon: '📥', desc: 'Entradas de USDT por cliente' },
  { key: 'retiros',         label: 'Retiros (S-003)',               icon: '📤', desc: 'Salidas de USDT' },
  { key: 'pago_qr',         label: 'Pagos QR (S-001)',              icon: '📲', desc: 'Pagos en BOB via QR' },
  { key: 'cobro_qr',        label: 'Cobros QR (S-002)',             icon: '💳', desc: 'Cobros en BOB via QR' },
  { key: 'transfers',       label: 'Transferencias (S-005)',        icon: '🔁', desc: 'Transfers entre clientes' },
  { key: 'saldos',          label: 'Saldos por cliente',           icon: '💰', desc: 'Balance final por cuenta' },
  { key: 'extracto_pagos',  label: 'Extracto Bancario — Pagos',    icon: '🏦', desc: 'Extracto del banco (pagos)' },
  { key: 'extracto_cobros', label: 'Extracto Bancario — Cobros',   icon: '🏦', desc: 'Extracto del banco (cobros)' },
]

// Columnas esperadas por el backend para cada tipo
const EXPECTED_COLS = {
  depositos:       ['account_id', 'account_name', 'fecha', 'crypto_quantity', 'product', 'ticket_number', 'ticket_status'],
  retiros:         ['account_id', 'account_name', 'fecha', 'crypto_quantity', 'product', 'crypto_fee', 'ticket_status'],
  pago_qr:         ['transaccion_id', 'numero_cuenta', 'creado_por', 'monto_pagado', 'moneda', 'fecha_creacion', 'estado'],
  cobro_qr:        ['transaccion_id', 'numero_cuenta', 'creado_por', 'monto_pagado', 'moneda', 'fecha_creacion', 'estado'],
  transfers:       ['transfer_number', 'sender_account', 'receiver_account', 'amount', 'product_symbol', 'created_at'],
  saldos:          ['account_id', 'account_name', 'debe', 'haber', 'saldo'],
  extracto_pagos:  ['codigo_transaccion', 'importe_bolivianos', 'fecha', 'hora'],
  extracto_cobros: ['codigo_transaccion', 'importe_bolivianos', 'fecha', 'hora'],
}

// Parse CSV simple para leer encabezados y muestra de filas en el browser
function parseCsvPreview(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { columns: [], sample: [] }
  // Detectar separador (coma o punto y coma)
  const sep = lines[0].includes(';') ? ';' : ','
  const columns = lines[0].split(sep).map(c => c.replace(/^"|"$/g, '').trim())
  const sample = lines.slice(1, 4).map(line => {
    const vals = line.split(sep).map(v => v.replace(/^"|"$/g, '').trim())
    return Object.fromEntries(columns.map((c, i) => [c, vals[i] ?? '']))
  })
  return { columns, sample }
}

// ── Paso 1: Zona de drop / selección de archivos ──────────────────────────────
function StepDropFiles({ files, onAddFiles, onRemove }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
    if (dropped.length) onAddFiles(dropped)
  }

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
        Sube uno o varios archivos CSV. Cada archivo puede representar un tipo de operación distinto.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#3b82f6' : '#334155'}`,
          borderRadius: 12, padding: '28px 20px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 16,
          background: dragging ? 'rgba(59,130,246,0.07)' : '#0f172a',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
          Arrastra archivos CSV aquí
        </div>
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
          o <span style={{ color: '#3b82f6', textDecoration: 'underline' }}>haz clic para seleccionar</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const picked = Array.from(e.target.files)
            if (picked.length) onAddFiles(picked)
            e.target.value = ''
          }}
        />
      </div>

      {/* Lista de archivos agregados */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Archivos cargados ({files.length})
          </div>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#1e293b', borderRadius: 8, padding: '10px 14px',
              border: '1px solid #334155',
            }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{f.file.name}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>{f.columns.length} columnas · {(f.file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                onClick={() => onRemove(i)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 4 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Paso 2: Asignar tipo + mapear columnas por archivo ────────────────────────
function StepMapColumns({ files, configs, onChangeConfig }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const current = files[activeIdx]
  const config = configs[activeIdx] || {}

  const setSheetType = (type) => onChangeConfig(activeIdx, { ...config, sheet_type: type })
  const setColMap = (origCol, targetCol) => {
    const col_map = { ...(config.col_map || {}) }
    if (targetCol) col_map[origCol] = targetCol
    else delete col_map[origCol]
    onChangeConfig(activeIdx, { ...config, col_map })
  }

  const expected = EXPECTED_COLS[config.sheet_type] || []

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
        Para cada archivo, elige qué tipo de datos contiene y opcionalmente mapea sus columnas a los nombres que el sistema espera.
      </p>

      {/* Tabs de archivos */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {files.map((f, i) => {
          const hasType = !!configs[i]?.sheet_type
          return (
            <button key={i} onClick={() => setActiveIdx(i)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeIdx === i ? '#2563eb' : '#1e293b',
              color: activeIdx === i ? 'white' : '#94a3b8',
              border: activeIdx === i ? 'none' : '1px solid #334155',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{hasType ? '✅' : '⚪'}</span>
              {f.file.name.length > 18 ? f.file.name.slice(0, 16) + '…' : f.file.name}
            </button>
          )
        })}
      </div>

      {current && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Selector de tipo */}
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              ¿Qué tipo de datos tiene este archivo?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SHEET_TYPES.map(st => (
                <button key={st.key} onClick={() => setSheetType(st.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: config.sheet_type === st.key ? 'rgba(59,130,246,0.15)' : '#0f172a',
                  border: config.sheet_type === st.key ? '1.5px solid #3b82f6' : '1.5px solid #1e293b',
                  borderRadius: 8, padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{st.icon}</span>
                  <div>
                    <div style={{ color: config.sheet_type === st.key ? '#93c5fd' : '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{st.label}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{st.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mapeo de columnas */}
          {config.sheet_type && (
            <div>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Mapear columnas (opcional — solo si los nombres son distintos)
              </div>
              <div style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e293b' }}>
                        Columna en tu CSV
                      </th>
                      <th style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e293b' }}>
                        Corresponde a →
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.columns.map((col, ci) => (
                      <tr key={ci} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '7px 14px', color: '#93c5fd', fontFamily: 'monospace' }}>{col}</td>
                        <td style={{ padding: '5px 14px' }}>
                          <select
                            value={config.col_map?.[col] || ''}
                            onChange={e => setColMap(col, e.target.value)}
                            style={{
                              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
                              borderRadius: 6, padding: '4px 8px', fontSize: 12, width: '100%',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">— no mapear —</option>
                            {expected.map(ec => (
                              <option key={ec} value={ec}>{ec}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Muestra de datos */}
              {current.sample.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Vista previa:</div>
                  <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #1e293b' }}>
                    <table style={{ fontSize: 11, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {current.columns.slice(0, 5).map(c => (
                            <th key={c} style={{ padding: '5px 10px', color: '#64748b', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap', textAlign: 'left' }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {current.sample.map((row, ri) => (
                          <tr key={ri}>
                            {current.columns.slice(0, 5).map(c => (
                              <td key={c} style={{ padding: '4px 10px', color: '#94a3b8', borderBottom: '1px solid #0f172a', whiteSpace: 'nowrap' }}>
                                {String(row[c] || '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Paso 3: Confirmación ──────────────────────────────────────────────────────
function StepConfirmCsv({ files, configs }) {
  const configured = files.filter((_, i) => configs[i]?.sheet_type)
  const totalRows = configured.length // No tenemos el conteo real de filas sin parsear completo

  return (
    <div style={{ textAlign: 'center', paddingTop: 10 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
        ¡Listo para procesar!
      </div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        Se enviarán <strong style={{ color: '#93c5fd' }}>{configured.length} archivos CSV</strong> al sistema de conciliación
      </div>
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 20px', textAlign: 'left', border: '1px solid #1e293b' }}>
        {files.map((f, i) => {
          const cfg = configs[i] || {}
          const st = SHEET_TYPES.find(s => s.key === cfg.sheet_type)
          const colMapped = Object.keys(cfg.col_map || {}).length
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: i < files.length - 1 ? '1px solid #1e293b' : 'none' }}>
              <span style={{ fontSize: 20 }}>{st?.icon || '📄'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{f.file.name}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>
                  {st ? st.label : '⚠️ Sin tipo asignado'} · {colMapped} columnas mapeadas
                </div>
              </div>
              {!cfg.sheet_type && <span style={{ color: '#f59e0b', fontSize: 12 }}>Será ignorado</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CsvOnboarding({ onConfirm, onCancel, uploading }) {
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState([])      // [{file, columns, sample}]
  const [configs, setConfigs] = useState([])  // [{sheet_type, col_map}]

  const steps = ['Subir archivos', 'Mapear columnas', 'Confirmar y procesar']

  const handleAddFiles = async (newFiles) => {
    const parsed = await Promise.all(newFiles.map(async (f) => {
      const text = await f.text()
      const { columns, sample } = parseCsvPreview(text)
      return { file: f, columns, sample }
    }))
    setFiles(prev => {
      const existing = new Set(prev.map(p => p.file.name))
      const unique = parsed.filter(p => !existing.has(p.file.name))
      const next = [...prev, ...unique]
      setConfigs(c => {
        const extended = [...c]
        while (extended.length < next.length) extended.push({})
        return extended
      })
      return next
    })
  }

  const handleRemove = (idx) => {
    setFiles(f => f.filter((_, i) => i !== idx))
    setConfigs(c => c.filter((_, i) => i !== idx))
  }

  const handleChangeConfig = (idx, cfg) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? cfg : c))
  }

  const handleConfirm = () => {
    // Preparar metadata para el backend
    const metadata = files.map((f, i) => ({
      filename: f.file.name,
      sheet_type: configs[i]?.sheet_type || '',
      column_map: configs[i]?.col_map || {},
    })).filter(m => m.sheet_type)

    const fileObjects = files.filter((_, i) => configs[i]?.sheet_type)
    onConfirm(fileObjects.map(f => f.file), metadata)
  }

  const canNext0 = files.length > 0
  const canNext1 = configs.some(c => c.sheet_type)

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
              <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>
                Importar archivos CSV
              </h2>
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                Puedes subir múltiples archivos de distintas fuentes
              </p>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {steps.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === step ? '#a78bfa' : i < step ? '#334155' : '#0f172a',
                    border: i < step ? '2px solid #22c55e' : i === step ? 'none' : '2px solid #334155',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: i < step ? '#22c55e' : 'white',
                    transition: 'all 0.2s',
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: i === step ? '#f1f5f9' : '#475569' }}>
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
          {step === 0 && <StepDropFiles files={files} onAddFiles={handleAddFiles} onRemove={handleRemove} />}
          {step === 1 && <StepMapColumns files={files} configs={configs} onChangeConfig={handleChangeConfig} />}
          {step === 2 && <StepConfirmCsv files={files} configs={configs} />}
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

          {step < 2 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 ? !canNext0 : !canNext1}
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                background: (step === 0 ? !canNext0 : !canNext1) ? '#374151' : '#7c3aed',
                color: 'white', cursor: (step === 0 ? !canNext0 : !canNext1) ? 'not-allowed' : 'pointer',
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
  )
}
