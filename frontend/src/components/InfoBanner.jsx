export default function InfoBanner({ children }) {
  return (
    <div style={{
      background: '#1e3a5f33',
      border: '1px solid #3b82f644',
      borderRadius: 10,
      padding: '14px 18px',
      color: '#93c5fd',
      fontSize: 13,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}
