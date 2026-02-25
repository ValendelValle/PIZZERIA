import { NavLink, Route, Routes } from 'react-router-dom';
import PosPage from './pages/PosPage';
import TicketPage from './pages/TicketPage';
import ProductionPage from './pages/ProductionPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <div className="app-root">
      <header className="main-nav">
        <div className="main-nav__brand">Pizzeria Escolar</div>
        <nav className="main-nav__links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            POS
          </NavLink>
          <NavLink to="/produccion" className={({ isActive }) => (isActive ? 'active' : '')}>
            Produccion
          </NavLink>
          <NavLink to="/admin-panel" className={({ isActive }) => (isActive ? 'active' : '')}>
            Admin
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<PosPage />} />
        <Route path="/ticket/:folio" element={<TicketPage />} />
        <Route path="/produccion" element={<ProductionPage />} />
        <Route path="/admin-panel" element={<AdminPage />} />
      </Routes>
    </div>
  );
}

export default App;