import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.data.user);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const saveSession = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    setUser(data.data.user);
  };

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    saveSession(data);
    return data.data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    saveSession(data);
    return data.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
