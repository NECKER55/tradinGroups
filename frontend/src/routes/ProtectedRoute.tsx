import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';

interface ProtectedRouteProps {
  requireSuperuser?: boolean;
}

export function ProtectedRoute({ requireSuperuser = false }: ProtectedRouteProps) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-obsidian text-canvas">
        <p className="text-sm tracking-wide text-canvas/80">Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperuser && !user?.is_superuser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
