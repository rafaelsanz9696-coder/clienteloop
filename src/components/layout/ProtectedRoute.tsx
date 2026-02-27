import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function ProtectedRoute() {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
