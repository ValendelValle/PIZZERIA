import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function getDefaultPathByRole(rol) {
  if (rol === 'admin') {
    return '/admin-panel';
  }
  if (rol === 'produccion') {
    return '/produccion';
  }
  return '/staff/login';
}

function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultPathByRole(user.rol)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const loggedUser = await login(form.username, form.password);
      const from = location.state?.from?.pathname;
      navigate(from || getDefaultPathByRole(loggedUser.rol), { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo iniciar sesion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen narrow-screen">
      <section className="payment-card auth-card">
        <h1>Acceso staff</h1>
        <p>Solo cocina y administracion.</p>

        {error && <p className="error-box">{error}</p>}

        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>
          <button type="submit" className="pay-btn" disabled={busy}>
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
