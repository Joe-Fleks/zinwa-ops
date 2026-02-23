import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isRouteAuthorizedForUser, getScopeRedirectPath } from '../lib/scopeUtils';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { accessContext, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !accessContext) return;

    const currentPath = location.pathname;

    console.log('[ROUTE GUARD] Checking route access:', {
      path: currentPath,
      userScope: accessContext.scopeType,
      userScopeId: accessContext.scopeId,
      serviceCentre: accessContext.serviceCentre?.name,
    });

    // Check if user is authorized to access this route
    const isAuthorized = isRouteAuthorizedForUser(currentPath, accessContext);

    if (!isAuthorized) {
      console.warn('[ROUTE GUARD] UNAUTHORIZED ACCESS ATTEMPT:', {
        user: accessContext.scopeType,
        userScopeId: accessContext.scopeId,
        attemptedPath: currentPath,
        reason: 'User scope does not match route scope',
      });

      // Log security event
      console.error('[SECURITY] Blocking unauthorized route access - redirecting to user dashboard');

      // Redirect to user's authorized dashboard
      const authorizedPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
      navigate(authorizedPath, { replace: true });

      // Show warning to user (optional - could add toast notification)
      alert('Access Denied: You are not authorized to access that resource. Redirecting to your dashboard.');
    } else {
      console.log('[ROUTE GUARD] ✓ Access granted');
    }
  }, [location.pathname, accessContext, loading, navigate]);

  return <>{children}</>;
}
