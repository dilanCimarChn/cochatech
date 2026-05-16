const COLORS = {
  CONCILIADO: { bg: '#14532d', text: '#86efac', label: 'Conciliado' },
  DISCREPANCIA: { bg: '#7f1d1d', text: '#fca5a5', label: 'Discrepancia' },
  SOLO_EN_QR: { bg: '#713f12', text: '#fde68a', label: 'Solo en QR' },
  SOLO_EN_BANCO: { bg: '#1e3a5f', text: '#93c5fd', label: 'Solo en Banco' },
}

export default function DiscrepancyBadge({ estado }) {
  const c = COLORS[estado] || { bg: '#374151', text: '#9ca3af', label: estado }
  return (
    <span style={{
      background: c.bg,
      color: c.text,
      borderRadius: 99,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}
