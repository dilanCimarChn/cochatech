import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import ConciliacionPagos from './pages/ConciliacionPagos'
import ConciliacionCobros from './pages/ConciliacionCobros'
import SaldosBob from './pages/SaldosBob'
import Saldos from './pages/Saldos'
import Reporte from './pages/Reporte'
import UploadButton from './components/UploadButton'
import { getMetricas } from './api'

// ── SVG icons ──────────────────────────────────────────────────────────────
const Icon = {
  home:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  pagos:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  cobros:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  bob:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  usdt:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  report:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  upload:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  dot:     (color) => <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />,
}

const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: '/', label: 'Dashboard', icon: Icon.home, end: true }],
  },
  {
    label: 'Conciliación',
    items: [
      { to: '/conciliacion/pagos',  label: 'Pagos QR',   icon: Icon.pagos,  badge: 'S-001', badgeColor: '#3b82f6' },
      { to: '/conciliacion/cobros', label: 'Cobros QR',  icon: Icon.cobros, badge: 'S-002', badgeColor: '#22c55e' },
    ],
  },
  {
    label: 'Saldos',
    items: [
      { to: '/saldos/bob', label: 'Saldo BOB',  icon: Icon.bob,  badge: 'BOB',  badgeColor: '#f59e0b' },
      { to: '/saldos',     label: 'Saldo USDT', icon: Icon.usdt, badge: 'USDT', badgeColor: '#34d399' },
    ],
  },
  {
    label: 'Exportar',
    items: [{ to: '/reporte', label: 'Reporte', icon: Icon.report }],
  },
]

function Sidebar({ loaded, onUploadSuccess }) {
  return (
    <aside style={{
      width: 230, background: '#070d1a',
      borderRight: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', letterSpacing: -0.3 }}>CryptoOps</div>
            <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>Banexcoin Bolivia</div>
          </div>
        </div>

        {/* Data status pill */}
        <div style={{
          marginTop: 12,
          background: loaded ? '#14532d33' : '#1e293b',
          border: `1px solid ${loaded ? '#22c55e44' : '#334155'}`,
          borderRadius: 6, padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {Icon.dot(loaded ? '#22c55e' : '#f59e0b')}
          <span style={{ fontSize: 11, color: loaded ? '#86efac' : '#94a3b8', fontWeight: 600 }}>
            {loaded ? 'Datos cargados' : 'Sin datos — sube un Excel'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 4 }}>
            {group.label && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 1.2, padding: '8px 10px 4px' }}>
                {group.label}
              </div>
            )}
            {group.items.map(({ to, label, icon, badge, badgeColor, end }) => (
              <NavLink
                key={to} to={to} end={end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  color: isActive ? '#f1f5f9' : '#64748b',
                  background: isActive ? '#1e293b' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.15s',
                  borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                })}
                onMouseEnter={(e) => { const el = e.currentTarget; if (!el.getAttribute('data-active')) { el.style.background = '#1e293b66'; el.style.color = '#e2e8f0' } }}
                onMouseLeave={(e) => { const el = e.currentTarget; if (!el.getAttribute('data-active')) { el.style.background = 'transparent'; el.style.color = '#64748b' } }}
              >
                <span style={{ flexShrink: 0, opacity: 0.85 }}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{label}</span>
                {badge && (
                  <span style={{
                    background: badgeColor + '22', color: badgeColor,
                    border: `1px solid ${badgeColor}44`,
                    borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700,
                  }}>{badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Upload button at bottom */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <UploadButton onSuccess={onUploadSuccess} compact />
        <div style={{ fontSize: 10, color: '#1e3a5f', textAlign: 'center' }}>
          Hackathon 2026 · Desafío 1
        </div>
      </div>
    </aside>
  )
}

function AppShell() {
  const [loaded, setLoaded] = useState(false)
  const location = useLocation()

  const checkLoaded = () => {
    getMetricas().then(() => setLoaded(true)).catch(() => setLoaded(false))
  }

  useEffect(() => { checkLoaded() }, [location.pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <Sidebar loaded={loaded} onUploadSuccess={() => { setLoaded(true); checkLoaded() }} />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Routes>
          <Route path="/" element={<Dashboard onUploadSuccess={() => setLoaded(true)} />} />
          <Route path="/conciliacion/pagos"  element={<ConciliacionPagos />} />
          <Route path="/conciliacion/cobros" element={<ConciliacionCobros />} />
          <Route path="/saldos/bob" element={<SaldosBob />} />
          <Route path="/saldos"     element={<Saldos />} />
          <Route path="/reporte"    element={<Reporte />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
