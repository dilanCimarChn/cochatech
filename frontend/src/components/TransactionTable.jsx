import DiscrepancyBadge from './DiscrepancyBadge'

const ROW_COLORS = {
  CONCILIADO: 'transparent',
  DISCREPANCIA: '#7f1d1d22',
  SOLO_EN_QR: '#71390d22',
  SOLO_EN_BANCO: '#1e3a5f33',
}

function fmt(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') return val.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  if (typeof val === 'boolean') return val ? 'Sí' : 'No'
  return String(val).split('T')[0] || '—'
}

export default function TransactionTable({ columns, data, page, pages, onPageChange }) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: '#1e293b',
                  color: '#94a3b8',
                  fontWeight: 600,
                  borderBottom: '1px solid #334155',
                  whiteSpace: 'nowrap',
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  Sin resultados
                </td>
              </tr>
            ) : data.map((row, i) => (
              <tr key={i} style={{ background: ROW_COLORS[row.estado] || 'transparent' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{
                    padding: '9px 14px',
                    borderBottom: '1px solid #1e293b',
                    color: '#e2e8f0',
                    whiteSpace: col.nowrap ? 'nowrap' : undefined,
                  }}>
                    {col.key === 'estado'
                      ? <DiscrepancyBadge estado={row[col.key]} />
                      : col.render
                        ? col.render(row[col.key], row)
                        : fmt(row[col.key])
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={paginBtn(page <= 1)}
          >
            Anterior
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Página {page} de {pages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            style={paginBtn(page >= pages)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

function paginBtn(disabled) {
  return {
    background: disabled ? '#1e293b' : '#2563eb',
    color: disabled ? '#64748b' : 'white',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
  }
}
