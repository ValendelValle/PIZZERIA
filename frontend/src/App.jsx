import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PosPage from './pages/PosPage';
import TicketPage from './pages/TicketPage';
import ProductionPage from './pages/ProductionPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

function App() {
  const { isAuthenticated, user, logout } = useAuth();

  const canProduccion = user?.rol === 'admin' || user?.rol === 'produccion';
  const canAdmin = user?.rol === 'admin';

  return (
    <div className="app-root">
      <header className="main-nav">
        <div className="main-nav__brand">Pizzeria Escolar</div>
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
            <button type="button" className="logout-btn" onClick={logout}>
              {user?.username} ({user?.rol}) - Salir
            </button>
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
