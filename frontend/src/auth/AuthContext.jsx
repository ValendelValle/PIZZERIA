import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import client, { getAuthToken, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getAuthToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await client.get('/auth/me/');
        setUser(data.usuario);
      } catch {
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [token]);

  const login = async (username, password) => {
    const { data } = await client.post('/auth/login/', { username, password });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.usuario);
    return data.usuario;
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout/', {});
    } catch {
      // Ignorar error de red al cerrar sesion local.
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
