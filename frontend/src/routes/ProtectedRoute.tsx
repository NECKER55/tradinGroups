import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';

export function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-obsidian text-canvas">
        <p className="text-sm tracking-wide text-canvas/80">Caricamento sessione...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
