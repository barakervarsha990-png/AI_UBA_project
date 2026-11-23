import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireManager = false }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (requireManager && user.role === 'employee') {
    return <Navigate to="/employee-portal" replace />;
  }

  return children;
};

export default ProtectedRoute;
