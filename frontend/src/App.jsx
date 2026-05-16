import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ConciliacionPagos from './pages/ConciliacionPagos'
import ConciliacionCobros from './pages/ConciliacionCobros'
import SaldosBob from './pages/SaldosBob'
import Saldos from './pages/Saldos'
import Reporte from './pages/Reporte'

const NAV = [
  { to: '/',                    label: 'Dashboard',           sub: 'Resumen general' },
  { to: '/conciliacion/pagos',  label: 'Pagos QR',            sub: 'S-001 vs Extracto pagos' },
  { to: '/conciliacion/cobros', label: 'Cobros QR',           sub: 'S-002 vs Extracto cobros' },
  { to: '/saldos/bob',          label: 'Saldo BOB',           sub: 'Debe, Haber y Saldo' },
  { to: '/saldos',              label: 'Saldo USDT',          sub: 'Saldo cripto por cliente' },
  { to: '/reporte',             label: 'Exportar',            sub: 'Excel y PDF' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
        {/* Sidebar */}
        <aside style={{
          width: 220,
          background: '#0a0f1e',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>CryptoOps</div>
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Banexcoin Bolivia</div>
          </div>
          <nav style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(({ to, label, sub }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '9px 14px',
                  borderRadius: 8,
                  color: isActive ? '#f1f5f9' : '#64748b',
                  background: isActive ? '#1e293b' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                })}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{sub}</div>
              </NavLink>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', padding: '0 20px', fontSize: 11, color: '#334155' }}>
            Hackathon 2026 · Desafío 1
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/conciliacion/pagos"  element={<ConciliacionPagos />} />
            <Route path="/conciliacion/cobros" element={<ConciliacionCobros />} />
            <Route path="/saldos/bob" element={<SaldosBob />} />
            <Route path="/saldos" element={<Saldos />} />
            <Route path="/reporte" element={<Reporte />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
