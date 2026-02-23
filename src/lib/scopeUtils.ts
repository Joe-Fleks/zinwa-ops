import { supabase } from './supabase';

export type ScopeType = 'SC' | 'CATCHMENT' | 'NATIONAL';

export interface Catchment {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface ServiceCentre {
  id: string;
  code: string;
  name: string;
  catchment_id: string;
  is_active: boolean;
}

export interface UserScopeInfo {
  scopeType: ScopeType;
  scopeId: string | null;
  serviceCentre?: ServiceCentre;
  catchment?: Catchment;
}

export interface AccessContext {
  permissions: string[];
  roleLevel: string;
  scopeType: ScopeType;
  scopeId: string | null;
  isSCScoped: boolean;
  isCatchmentScoped: boolean;
  isNationalScoped: boolean;
  allowedServiceCentreIds: string[];
  allowedCatchmentIds: string[];
  canManageUsers: boolean;
  canManageRoles: boolean;
  canAssignScope: boolean;
  canResetPassword: boolean;
  serviceCentre?: ServiceCentre;
  catchment?: Catchment;
  userAuthorityRank: number;
  userSystemRank: number;
}

export const defaultAccessContext: AccessContext = {
  permissions: [],
  roleLevel: '',
  scopeType: 'SC',
  scopeId: null,
  isSCScoped: false,
  isCatchmentScoped: false,
  isNationalScoped: false,
  allowedServiceCentreIds: [],
  allowedCatchmentIds: [],
  canManageUsers: false,
  canManageRoles: false,
  canAssignScope: false,
  canResetPassword: false,
  userAuthorityRank: 0,
  userSystemRank: 0,
};

export async function fetchCatchments(): Promise<Catchment[]> {
  const { data, error } = await supabase
    .from('catchments')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching catchments:', error);
    return [];
  }

  return data || [];
}

export async function fetchServiceCentres(): Promise<ServiceCentre[]> {
  const { data, error } = await supabase
    .from('service_centres')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching service centres:', error);
    return [];
  }

  return data || [];
}

export async function fetchServiceCentresByCatchment(catchmentId: string): Promise<ServiceCentre[]> {
  const { data, error } = await supabase
    .from('service_centres')
    .select('*')
    .eq('catchment_id', catchmentId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching service centres for catchment:', error);
    return [];
  }

  return data || [];
}

export async function fetchServiceCentreById(id: string): Promise<ServiceCentre | null> {
  const { data, error } = await supabase
    .from('service_centres')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching service centre:', error);
    return null;
  }

  return data;
}

export async function fetchCatchmentById(id: string): Promise<Catchment | null> {
  const { data, error } = await supabase
    .from('catchments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching catchment:', error);
    return null;
  }

  return data;
}

export async function getUserScopeInfo(userId: string): Promise<UserScopeInfo | null> {
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select(`
      scope_type,
      scope_id,
      roles!inner(name)
    `)
    .eq('user_id', userId)
    .is('effective_to', null);

  if (error || !userRoles || userRoles.length === 0) {
    console.error('Error fetching user scope info:', error);
    return null;
  }

  const userRole = userRoles[0];
  const scopeType = (userRole.scope_type || 'NATIONAL') as ScopeType;
  const scopeId = userRole.scope_id;

  const scopeInfo: UserScopeInfo = {
    scopeType,
    scopeId,
  };

  if (scopeType === 'SC' && scopeId) {
    const sc = await fetchServiceCentreById(scopeId);
    if (sc) {
      scopeInfo.serviceCentre = sc;
      const catchment = await fetchCatchmentById(sc.catchment_id);
      if (catchment) {
        scopeInfo.catchment = catchment;
      }
    }
  } else if (scopeType === 'CATCHMENT' && scopeId) {
    const catchment = await fetchCatchmentById(scopeId);
    if (catchment) {
      scopeInfo.catchment = catchment;
    }
  }

  return scopeInfo;
}

export async function getAllowedServiceCentreIds(scopeType: ScopeType, scopeId: string | null): Promise<string[]> {
  if (scopeType === 'NATIONAL') {
    const scs = await fetchServiceCentres();
    return scs.map(sc => sc.id);
  }

  if (scopeType === 'CATCHMENT' && scopeId) {
    const scs = await fetchServiceCentresByCatchment(scopeId);
    return scs.map(sc => sc.id);
  }

  if (scopeType === 'SC' && scopeId) {
    return [scopeId];
  }

  return [];
}

export async function getAllowedCatchmentIds(scopeType: ScopeType, scopeId: string | null): Promise<string[]> {
  if (scopeType === 'NATIONAL') {
    const catchments = await fetchCatchments();
    return catchments.map(c => c.id);
  }

  if (scopeType === 'CATCHMENT' && scopeId) {
    return [scopeId];
  }

  if (scopeType === 'SC' && scopeId) {
    const sc = await fetchServiceCentreById(scopeId);
    if (sc) {
      return [sc.catchment_id];
    }
  }

  return [];
}

export function getScopeRedirectPath(scopeType: ScopeType, scopeId: string | null): string {
  if (scopeType === 'SC' && scopeId) {
    return `/sc/${scopeId}/dashboard`;
  }

  if (scopeType === 'CATCHMENT' && scopeId) {
    return `/catchment/${scopeId}/dashboard`;
  }

  if (scopeType === 'NATIONAL') {
    return '/national/dashboard';
  }

  return '/dashboard';
}

export function isRouteAuthorizedForUser(
  pathname: string,
  accessContext: AccessContext | null
): boolean {
  if (!accessContext) return false;

  // Admin routes - check if user can access admin
  if (pathname.startsWith('/admin')) {
    return accessContext.userSystemRank >= 70;
  }

  // Extract scope info from URL
  const scMatch = pathname.match(/^\/sc\/([^/]+)/);
  const catchmentMatch = pathname.match(/^\/catchment\/([^/]+)/);
  const nationalMatch = pathname.startsWith('/national');

  // If route has /sc/{id}, check if user has access to that SC
  if (scMatch) {
    const routeSCId = scMatch[1];

    // User must be SC-scoped with matching ID OR higher-level scope that includes this SC
    if (accessContext.isSCScoped) {
      return accessContext.scopeId === routeSCId;
    }

    // Catchment or National users can access if SC is in their allowed list
    return accessContext.allowedServiceCentreIds.includes(routeSCId);
  }

  // If route has /catchment/{id}, check if user has access to that catchment
  if (catchmentMatch) {
    const routeCatchmentId = catchmentMatch[1];

    // User must be Catchment-scoped with matching ID OR National scope
    if (accessContext.isCatchmentScoped) {
      return accessContext.scopeId === routeCatchmentId;
    }

    return accessContext.isNationalScoped;
  }

  // If route is /national/*, only national users can access
  if (nationalMatch) {
    return accessContext.isNationalScoped;
  }

  // Legacy routes without scope prefix - allow for backward compatibility
  // but they should redirect to proper scoped routes
  return true;
}

