import { useRef, useState, useEffect } from 'react'
import { previewExcel, uploadExcelSheets, uploadCsv } from '../api'
import ExcelOnboarding from './ExcelOnboarding'
import CsvOnboarding from './CsvOnboarding'

export default function UploadButton({ onSuccess }) {
  const [loading, setLoading]       = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError]           = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)

  // Estado Excel
  const [previewData, setPreviewData] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)

  // Estado CSV
  const [csvOpen, setCsvOpen] = useState(false)

  const excelRef = useRef()
  const menuRef  = useRef()

  // Cerrar menú al hacer clic afuera
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // ── Flujo Excel ────────────────────────────────────────────────────────────
  const handleExcelChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setMenuOpen(false)
    setPreviewing(true)
    setError(null)
    try {
      const res = await previewExcel(file)
      setPendingFile(file)
      setPreviewData(res.data)
    } catch {
      setError('No se pudo leer el Excel. Verifique que sea un archivo válido.')
    }
    setPreviewing(false)
  }

  const handleExcelConfirm = async (selectedSheets) => {
    if (!pendingFile) return
    setLoading(true)
    setError(null)
    try {
      const res = await uploadExcelSheets(pendingFile, selectedSheets)
      setPreviewData(null)
      setPendingFile(null)
      onSuccess?.(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar el Excel')
    } finally {
      setLoading(false)
    }
  }

  const handleExcelCancel = () => {
    setPreviewData(null)
    setPendingFile(null)
    setError(null)
  }

  // ── Flujo CSV ──────────────────────────────────────────────────────────────
  const handleCsvOpen = () => {
    setMenuOpen(false)
    setCsvOpen(true)
  }

  const handleCsvConfirm = async (files, metadata) => {
    setLoading(true)
    setError(null)
    try {
      const res = await uploadCsv(files, metadata)
      setCsvOpen(false)
      onSuccess?.(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar los CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvCancel = () => {
    setCsvOpen(false)
    setError(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isWorking = loading || previewing
  const btnLabel  = previewing ? 'Leyendo...' : loading ? 'Procesando...' : 'Cargar Datos'
  const btnIcon   = previewing ? '🔍' : loading ? '⏳' : '📂'

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 6 }}>

        {/* ── Botón principal con chevron ── */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', boxShadow: isWorking ? 'none' : '0 4px 14px rgba(37,99,235,0.35)' }}>
          {/* Parte izquierda: acción del último modo (Excel por defecto) */}
          <button
            id="btn-cargar-datos"
            onClick={() => !isWorking && excelRef.current?.click()}
            disabled={isWorking}
            style={{
              background: isWorking ? '#374151' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white', border: 'none', padding: '10px 16px',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s', borderRight: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <span style={{ fontSize: 16 }}>{btnIcon}</span>
            {btnLabel}
          </button>

          {/* Parte derecha: chevron para abrir el menú */}
          <button
            onClick={() => !isWorking && setMenuOpen(o => !o)}
            disabled={isWorking}
            style={{
              background: isWorking ? '#374151' : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
              color: 'white', border: 'none', padding: '10px 12px',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.2s',
            }}
            title="Más opciones de carga"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* ── Dropdown menu ── */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 200, minWidth: 220,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 0' }}>
              <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 14px 8px' }}>
                Elegir formato
              </div>

              {/* Opción Excel */}
              <button
                onClick={() => { setMenuOpen(false); excelRef.current?.click() }}
                style={{
                  width: '100%', background: 'none', border: 'none', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>📊</span>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Excel (.xlsx / .xls)</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Un archivo con múltiples hojas</div>
                </div>
              </button>

              <div style={{ margin: '4px 14px', borderTop: '1px solid #1e3a5f' }} />

              {/* Opción CSV */}
              <button
                onClick={handleCsvOpen}
                style={{
                  width: '100%', background: 'none', border: 'none', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Archivos CSV</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Múltiples archivos de distintas fuentes</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Input oculto para Excel */}
        <input
          ref={excelRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelChange}
          style={{ display: 'none' }}
        />

        {/* Mensaje de error */}
        {error && (
          <div style={{ color: '#fca5a5', fontSize: 12, maxWidth: 260 }}>{error}</div>
        )}
      </div>

      {/* Modal Excel onboarding */}
      {previewData && (
        <ExcelOnboarding
          previewData={previewData}
          originalFile={pendingFile}
          onConfirm={handleExcelConfirm}
          onCancel={handleExcelCancel}
          uploading={loading}
        />
      )}

      {/* Modal CSV onboarding */}
      {csvOpen && (
        <CsvOnboarding
          onConfirm={handleCsvConfirm}
          onCancel={handleCsvCancel}
          uploading={loading}
        />
      )}
    </>
  )
}
