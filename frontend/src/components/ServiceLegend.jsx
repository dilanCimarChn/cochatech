const SERVICES = [
  { code: 'S-001', name: 'Pago QR',       effect: 'Disminuye saldo', color: '#ef4444', icon: '↓', note: 'Se cruza con extracto bancario' },
  { code: 'S-002', name: 'Cobro QR',      effect: 'Aumenta saldo',   color: '#22c55e', icon: '↑', note: 'Se cruza con extracto bancario' },
  { code: 'S-003', name: 'Retiros',        effect: 'Disminuye saldo', color: '#f59e0b', icon: '↓', note: 'Salida de USDT' },
  { code: 'S-004', name: 'Depósitos',      effect: 'Aumenta saldo',   color: '#34d399', icon: '↑', note: 'Entrada de USDT' },
  { code: 'S-005', name: 'Banextransfer',  effect: 'Entre clientes',  color: '#a78bfa', icon: '⇄', note: 'Transferencia interna Banexcoin' },
]

export default function ServiceLegend({ highlight }) {
  const items = highlight ? SERVICES.filter(s => highlight.includes(s.code)) : SERVICES
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {items.map(s => (
        <div key={s.code} style={{
          background: '#1e293b',
          border: `1px solid ${s.color}44`,
          borderRadius: 8,
          padding: '10px 14px',
          minWidth: 170,
          flex: '1 1 170px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ background: s.color + '22', color: s.color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              {s.code}
            </span>
            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{s.name}</span>
          </div>
          <div style={{ color: s.color, fontSize: 12, fontWeight: 600 }}>
            {s.icon} {s.effect}
          </div>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{s.note}</div>
        </div>
      ))}
    </div>
  )
}
