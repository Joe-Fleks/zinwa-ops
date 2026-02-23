import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getScopeRedirectPath } from '../../lib/scopeUtils';

interface ScopeGuardProps {
  children: ReactNode;
  requiredScopes?: Array<'SC' | 'CATCHMENT' | 'NATIONAL'>;
  allowedScopeIds?: string[];
}

export default function ScopeGuard({
  children,
  requiredScopes,
  allowedScopeIds
}: ScopeGuardProps) {
  const navigate = useNavigate();
  const { accessContext, loading } = useAuth();

  if (loading || !accessContext) {
    return <div className="text-center py-12 text-gray-600">Loading...</div>;
  }

  if (requiredScopes && !requiredScopes.includes(accessContext.scopeType)) {
    const defaultPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
    navigate(defaultPath, { replace: true });
    return null;
  }

  if (allowedScopeIds && accessContext.scopeId && !allowedScopeIds.includes(accessContext.scopeId)) {
    const defaultPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
    navigate(defaultPath, { replace: true });
    return null;
  }

  return <>{children}</>;
}
