import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isRouteAuthorizedForUser, getScopeRedirectPath } from '../lib/scopeUtils';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { accessContext, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    if (loading || !accessContext) return;

    const currentPath = location.pathname;
    const isAuthorized = isRouteAuthorizedForUser(currentPath, accessContext);

    if (!isAuthorized) {
      setAuthorized(false);
      const authorizedPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
      navigate(authorizedPath, { replace: true });
    } else {
      setAuthorized(true);
    }
  }, [location.pathname, accessContext, loading, navigate]);

  if (loading || !authorized) {
    return null;
  }

  return <>{children}</>;
}
