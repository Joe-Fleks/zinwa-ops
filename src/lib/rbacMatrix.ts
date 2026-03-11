import { ScopeType } from './scopeUtils';

export type RoleKey = 'TO' | 'RO' | 'MO' | 'STL' | 'CM' | 'WSSE' | 'WSSM' | 'Director' | 'CEO' | 'Maintenance Manager' | 'Global Admin' | 'Standard User' | 'Viewer';

export const ROLE_SCOPE_MATRIX: Record<RoleKey, ScopeType[]> = {
  'TO': ['SC'],
  'RO': ['SC'],
  'MO': ['SC'],
  'STL': ['SC'],
  'CM': ['CATCHMENT'],
  'WSSE': ['NATIONAL'],
  'WSSM': ['NATIONAL'],
  'Director': ['NATIONAL'],
  'CEO': ['NATIONAL'],
  'Maintenance Manager': ['NATIONAL'],
  'Global Admin': ['NATIONAL'],
  'Standard User': ['SC', 'CATCHMENT', 'NATIONAL'],
  'Viewer': ['SC', 'CATCHMENT', 'NATIONAL'],
};

export function getAllowedScopesForRole(roleName: string): ScopeType[] {
  const roleKey = roleName as RoleKey;
  return ROLE_SCOPE_MATRIX[roleKey] || ['SC'];
}

export function isRoleScopeCompatible(roleName: string, scopeType: ScopeType): boolean {
  const allowedScopes = getAllowedScopesForRole(roleName);
  return allowedScopes.includes(scopeType);
}

export function validateRoleScope(roleName: string, scopeType: ScopeType): { valid: boolean; error?: string } {
  if (!roleName || !scopeType) {
    return { valid: false, error: 'Role and scope type are required' };
  }

  const allowedScopes = getAllowedScopesForRole(roleName);

  if (!allowedScopes.includes(scopeType)) {
    const scopeList = allowedScopes.join(' or ');
    return {
      valid: false,
      error: `Role "${roleName}" must use ${scopeList} scope`,
    };
  }

  return { valid: true };
}
