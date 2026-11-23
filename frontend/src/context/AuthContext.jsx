import { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('soc_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, user: u } = res.data;
      localStorage.setItem('soc_token', token);
      localStorage.setItem('soc_user', JSON.stringify(u));
      setUser(u);
      return { success: true, user: u };
    } catch (err) {
      let msg = err.response?.data?.message;
      if (!msg) {
        if (err.message === 'Network Error' || !err.response) {
          msg = 'Unable to connect to backend API server. Please verify backend deployment and network connection.';
        } else {
          msg = 'Authentication failed. Please verify credentials.';
        }
      }
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('soc_token');
    localStorage.removeItem('soc_user');
    setUser(null);
  }, []);

  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, isManagerOrAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
