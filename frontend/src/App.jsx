import { LogOut, Pizza, ShieldCheck } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PosPage from './pages/PosPage';
import TicketPage from './pages/TicketPage';
import ProductionPage from './pages/ProductionPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

const ROUTE_META = {
  '/': { label: 'Publico', helper: 'Pedidos y pago simulado' },
  '/ticket': { label: 'Ticket', helper: 'Seguimiento del pedido' },
  '/staff/login': { label: 'Staff', helper: 'Acceso interno' },
  '/produccion': { label: 'Produccion', helper: 'Cola operativa' },
  '/admin-panel': { label: 'Admin', helper: 'Control del negocio' },
};

function App() {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const canProduccion = user?.rol === 'admin' || user?.rol === 'produccion';
  const canAdmin = user?.rol === 'admin';
  const routeMeta =
    Object.entries(ROUTE_META).find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`))?.[1] ||
    ROUTE_META['/'];

  return (
    <div className="app-root">
      <header className="main-nav">
        <div className="main-nav__brand">
          <div className="main-nav__brand-badge">
            <Pizza size={18} />
          </div>
          <div>
            <strong>Pizzeria Escolar POS</strong>
            <span>
              {routeMeta.label} - {routeMeta.helper}
            </span>
          </div>
        </div>
        <nav className="main-nav__links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Ordenar
          </NavLink>

          {!isAuthenticated && (
            <NavLink to="/staff/login" className={({ isActive }) => (isActive ? 'active' : '')}>
              Staff
            </NavLink>
          )}

          {isAuthenticated && canProduccion && (
            <NavLink to="/produccion" className={({ isActive }) => (isActive ? 'active' : '')}>
              Produccion
            </NavLink>
          )}
          {isAuthenticated && canAdmin && (
            <NavLink to="/admin-panel" className={({ isActive }) => (isActive ? 'active' : '')}>
              Admin
            </NavLink>
          )}

          {isAuthenticated && (
            <>
              <span className="session-pill">
                <ShieldCheck size={16} />
                {user?.username} - {user?.rol}
              </span>
              <button type="button" className="logout-btn" onClick={logout}>
                <LogOut size={16} />
                Salir
              </button>
            </>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<PosPage />} />
        <Route path="/ticket/:folio" element={<TicketPage />} />
        <Route path="/staff/login" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/sin-acceso" element={<UnauthorizedPage />} />

        <Route
          path="/produccion"
          element={
            <ProtectedRoute roles={['produccion', 'admin']}>
              <ProductionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-panel"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
