import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function ProtectedRoute({ children, roles = [] }) {
  const location = useLocation();
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <main className="screen narrow-screen">
        <p>Cargando sesion...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace state={{ from: location }} />;
  }

  if (roles.length > 0 && !roles.includes(user?.rol)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return children;
}

export default ProtectedRoute;
