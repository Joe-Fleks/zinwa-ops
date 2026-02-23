import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './auth/LoginPage';
import { ChangePassword } from '../pages/ChangePassword';
import { getScopeRedirectPath } from '../lib/scopeUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, accessContext } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Redirect to user's default dashboard after successful login
  useEffect(() => {
    if (!loading && user && accessContext && !hasRedirected) {
      const isRootPath = location.pathname === '/' || location.pathname === '';

      if (isRootPath) {
        console.log('[LOGIN REDIRECT] Redirecting user to their default dashboard:', {
          scopeType: accessContext.scopeType,
          scopeId: accessContext.scopeId,
        });

        const defaultPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
        setHasRedirected(true);
        navigate(defaultPath, { replace: true });
      }
    }
  }, [user, accessContext, loading, location.pathname, hasRedirected, navigate]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md p-8 text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Configuration Error</h2>
          <p className="text-gray-600 mb-4">
            The application is not properly configured. Please contact your administrator.
          </p>
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            Missing Supabase environment variables
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const forcePasswordReset = sessionStorage.getItem('forcePasswordReset') === 'true';
  if (forcePasswordReset) {
    return <ChangePassword />;
  }

  return <>{children}</>;
}
