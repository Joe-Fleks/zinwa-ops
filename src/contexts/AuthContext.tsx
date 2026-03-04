import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';
import { startPresenceTracking, stopPresenceTracking } from '../lib/presenceService';
import {
  ScopeType,
  ServiceCentre,
  Catchment,
  AccessContext,
  defaultAccessContext,
  getAllowedServiceCentreIds,
  getAllowedCatchmentIds,
  fetchServiceCentreById,
  fetchCatchmentById,
} from '../lib/scopeUtils';

export interface UserRole {
  id: string;
  name: string;
  description: string;
  authority_rank?: number;
  system_rank?: number;
  scope_type?: string | null;
  scope_id?: string | null;
}

export interface UserScope {
  id: string;
  scope_type: ScopeType;
  scope_id: string | null;
}

export type { AccessContext, ScopeType, ServiceCentre, Catchment };

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  roles: UserRole[];
  scopes: UserScope[];
  accessContext: AccessContext | null;
  loading: boolean;
  isActive: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  getServiceCentreId: () => string | null;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

declare global {
  interface Window {
    auditRLS: {
      testAnonQuery: () => Promise<void>;
      testAuthQuery: () => Promise<void>;
      getSessionInfo: () => Promise<void>;
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [scopes, setScopes] = useState<UserScope[]>([]);
  const [accessContext, setAccessContext] = useState<AccessContext | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('\n[APP INIT] AuthProvider mounted - checking existing session');

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[APP INIT] getSession result:', {
          authenticated: !!session?.user,
          userId: session?.user?.id || null,
          email: session?.user?.email || null,
        });

        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserData(session.user.id);
        } else {
          console.log('[APP INIT] No session found - app in ANON state');
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('[APP INIT] Error getting session:', error);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AUTH STATE CHANGE] Event:', _event, 'Authenticated:', !!session?.user);

      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        stopPresenceTracking();
        setProfile(null);
        setRoles([]);
        setScopes([]);
        setAccessContext(null);
        setLoading(false);
      }
    });

    window.auditRLS = {
      testAnonQuery: async () => {
        console.log('\n[MANUAL TEST] Testing ANON SELECT (simulating pre-login state)');
        await testRLSQuery('MANUAL_ANON_TEST', false);
      },
      testAuthQuery: async () => {
        const session = await supabase.auth.getSession();
        if (session.data.session?.user) {
          console.log('\n[MANUAL TEST] Testing AUTH SELECT (post-login)');
          await testAuthenticatedRLSQuery('MANUAL_AUTH_TEST', session.data.session.user.id);
        } else {
          console.log('[MANUAL TEST] ERROR: Not authenticated');
        }
      },
      getSessionInfo: async () => {
        console.log('\n[MANUAL TEST] Getting current session info');
        await getSessionInfo('MANUAL_SESSION_CHECK');
      },
    };

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      console.log('\n--- STEP 4: loadUserData() Phase (AUTHENTICATED ROLE) ---');
      console.log('[RBAC AUDIT] Starting data load for user:', userId);

      const session = await supabase.auth.getSession();
      const isAuthenticated = !!session.data.session?.user;
      console.log('[SESSION AUDIT] loadUserData session check:', {
        authenticated: isAuthenticated,
        sessionUserId: session.data.session?.user?.id || null,
      });

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('[RBAC AUDIT] ERROR - user_profiles query failed:', {
          code: profileError.code,
          message: profileError.message,
          hint: profileError.hint,
          details: profileError.details,
        });
        throw profileError;
      }

      console.log('[RBAC AUDIT] user_profiles query result:', {
        found: !!profileData,
        id: profileData?.id || null,
        email: profileData?.email || null,
      });

      if (profileData) {
        setProfile(profileData);
        setIsActive(profileData.is_active ?? true);
      }

      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);

      console.log('[RBAC AUDIT] Querying user_roles with filter: user_id = %s AND effective_to IS NULL', userId);

      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          id,
          role_id,
          scope_type,
          scope_id,
          roles!inner(id, name, description, authority_rank, system_rank)
        `)
        .eq('user_id', userId)
        .is('effective_to', null);

      if (rolesError) {
        console.error('[RBAC AUDIT] ERROR - user_roles query failed:', {
          code: rolesError.code,
          message: rolesError.message,
          hint: rolesError.hint,
          details: rolesError.details,
        });
        throw rolesError;
      }

      console.log('[RBAC AUDIT] user_roles query result:', {
        count: userRolesData?.length || 0,
        data: userRolesData,
      });

      const userRoles: UserRole[] = userRolesData?.map(ur => {
        const role = ur.roles as any;
        return {
          id: role.id,
          name: role.name,
          description: role.description,
          authority_rank: role.authority_rank,
          system_rank: role.system_rank,
          scope_type: ur.scope_type,
          scope_id: ur.scope_id,
        };
      }).filter(Boolean) || [];

      console.log('[RBAC AUDIT] Resolved roles array:', {
        count: userRoles.length,
        roles: userRoles.map(r => ({
          id: r.id,
          name: r.name,
          authority_rank: r.authority_rank,
          system_rank: r.system_rank,
          scope_type: r.scope_type,
          scope_id: r.scope_id,
        })),
      });

      const operationalRoles = userRoles.filter(r => r.scope_type && r.scope_type !== 'NATIONAL');
      const adminRoles = userRoles.filter(r => r.system_rank && r.system_rank > 0);

      console.log('[RBAC AUDIT] Separated roles:', {
        operationalCount: operationalRoles.length,
        adminCount: adminRoles.length,
        operationalRoles: operationalRoles.map(r => ({ name: r.name, scope_type: r.scope_type, scope_id: r.scope_id })),
        adminRoles: adminRoles.map(r => ({ name: r.name, system_rank: r.system_rank })),
      });

      if (operationalRoles.length > 1) {
        const error = new Error('[SCOPE VALIDATION] CRITICAL: User has multiple operational scopes. This violates system design.');
        console.error(error.message);
        throw error;
      }

      const maxAuthorityRank = Math.max(...userRoles.map((r: any) => r.authority_rank || 0), 0);
      const maxSystemRank = Math.max(...userRoles.map((r: any) => r.system_rank || 0), 0);

      console.log('[RBAC AUDIT] Calculated ranks:', {
        maxAuthorityRank,
        maxSystemRank,
      });

      setRoles(userRoles as UserRole[]);

      const { data: scopesData, error: scopesError } = await supabase
        .from('user_scope')
        .select('*')
        .eq('user_id', userId);

      if (scopesError) {
        console.error('[RBAC AUDIT] ERROR - user_scope query failed:', {
          code: scopesError.code,
          message: scopesError.message,
        });
        throw scopesError;
      }

      setScopes(scopesData || []);

      await buildAccessContext(userId, userRoles, operationalRoles, adminRoles, maxAuthorityRank, maxSystemRank, profileData);

      startPresenceTracking(userId);
    } catch (error) {
      console.error('[RBAC AUDIT] ERROR loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildAccessContext = async (
    userId: string,
    userRoles: UserRole[],
    operationalRoles: UserRole[],
    adminRoles: UserRole[],
    maxAuthorityRank: number = 0,
    maxSystemRank: number = 0,
    profileData?: UserProfile
  ) => {
    try {
      console.log('\n--- STEP 5: buildAccessContext Phase (SCOPE REFACTOR) ---');
      console.log('[RBAC AUDIT] Building access context for user:', userId);
      console.log('[DUAL POWER MODEL] Authority Rank:', maxAuthorityRank, 'System Rank:', maxSystemRank);
      console.log('[SCOPE RESOLUTION] Admin roles count:', adminRoles.length, 'Operational roles count:', operationalRoles.length);

      if (userRoles.length === 0) {
        console.log('[RBAC AUDIT] No roles found - using default access context');
        setAccessContext(defaultAccessContext);
        return;
      }

      // HARD VALIDATION: Admin roles require operational role
      if (adminRoles.length > 0 && operationalRoles.length === 0) {
        const validationError = new Error(
          '[SCOPE VALIDATION] CRITICAL: User has administrative role but no operational scope. ' +
          'This is not allowed per system design.'
        );
        console.error(validationError.message);
        throw validationError;
      }

      const roleIds = userRoles.map(r => r.id);
      console.log('[RBAC AUDIT] Querying permissions for roles:', roleIds);

      const { data: permissionsData, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions!inner(permission_key)
        `)
        .in('role_id', roleIds);

      if (permError) {
        console.error('[RBAC AUDIT] ERROR - role_permissions query failed:', {
          code: permError.code,
          message: permError.message,
          hint: permError.hint,
          details: permError.details,
        });
        throw permError;
      }

      const permissions = (permissionsData || [])
        .map((p: any) => p.permissions?.permission_key)
        .filter(Boolean) as string[];

      console.log('[RBAC AUDIT] Resolved permissions array:', {
        count: permissions.length,
        permissions: permissions,
      });

      // SCOPE RESOLUTION: Determine operational scope from operational role (NOT effective_from, NOT system_rank)
      let scopeType: ScopeType = 'NATIONAL';
      let scopeId: string | null = null;

      if (operationalRoles.length === 1) {
        const opRole = operationalRoles[0];
        scopeType = (opRole.scope_type as ScopeType) || 'NATIONAL';
        scopeId = opRole.scope_id || null;
        console.log('[SCOPE RESOLUTION] Using operational role scope:', { scopeType, scopeId, roleName: opRole.name });
      } else if (operationalRoles.length === 0) {
        // No operational role = no access
        const noRoleError = new Error(
          '[SCOPE VALIDATION] CRITICAL: User has no operational role assigned. Access denied.'
        );
        console.error(noRoleError.message);
        throw noRoleError;
      }

      console.log('[SCOPE RESOLUTION] Final scope determination:', { scopeType, scopeId });

      const isSCScoped = scopeType === 'SC';
      const isCatchmentScoped = scopeType === 'CATCHMENT';
      const isNationalScoped = scopeType === 'NATIONAL';

      // ADMIN VISIBILITY: Determined by maxSystemRank >= 70, NOT by scope
      const canAccessAdmin = maxSystemRank >= 70;
      console.log('[ADMIN ACCESS] Can access admin module:', canAccessAdmin, 'System rank:', maxSystemRank);

      const allowedServiceCentreIds = await getAllowedServiceCentreIds(scopeType, scopeId);
      const allowedCatchmentIds = await getAllowedCatchmentIds(scopeType, scopeId);

      let serviceCentre: ServiceCentre | undefined;
      let catchment: Catchment | undefined;

      if (isSCScoped && scopeId) {
        serviceCentre = await fetchServiceCentreById(scopeId) || undefined;
        if (serviceCentre) {
          catchment = await fetchCatchmentById(serviceCentre.catchment_id) || undefined;
        }
      } else if (isCatchmentScoped && scopeId) {
        catchment = await fetchCatchmentById(scopeId) || undefined;
      }

      const roleLevel = operationalRoles[0]?.name || userRoles[0]?.name || '';

      const context: AccessContext = {
        permissions,
        roleLevel,
        scopeType,
        scopeId,
        isSCScoped,
        isCatchmentScoped,
        isNationalScoped,
        allowedServiceCentreIds,
        allowedCatchmentIds,
        canManageUsers: permissions.includes('manage_users'),
        canManageRoles: permissions.includes('manage_roles'),
        canAssignScope: permissions.includes('assign_scope'),
        canResetPassword: permissions.includes('reset_password'),
        serviceCentre,
        catchment,
        userAuthorityRank: maxAuthorityRank,
        userSystemRank: maxSystemRank,
      };

      console.log('[SCOPE VALIDATION] FINAL CONFIRMATION:', {
        scopeType,
        scopeId,
        operationalRolesCount: operationalRoles.length,
        adminRolesCount: adminRoles.length,
        canAccessAdminModule: canAccessAdmin,
        defaultWorkingScope: { scopeType, scopeId },
      });

      console.log('[RBAC] Final Access Context:', {
        userId,
        email: profileData?.email,
        roleLevel: context.roleLevel,
        scopeType: context.scopeType,
        scopeId: context.scopeId,
        permissions: context.permissions,
        allowedServiceCentres: context.allowedServiceCentreIds.length,
        allowedCatchments: context.allowedCatchmentIds.length,
        userAuthorityRank: context.userAuthorityRank,
        userSystemRank: context.userSystemRank,
        canManageUsers: context.canManageUsers,
        canManageRoles: context.canManageRoles,
        canAssignScope: context.canAssignScope,
        canResetPassword: context.canResetPassword,
        canAccessAdmin: canAccessAdmin,
      });
      console.log('\n========== SCOPE RESOLUTION AND RBAC AUDIT COMPLETE ==========\n');

      setAccessContext(context);
    } catch (error) {
      console.error('[RBAC AUDIT] ERROR building access context:', error);
      setAccessContext(defaultAccessContext);
    }
  };

  const getSessionInfo = async (phase: string) => {
    const session = await supabase.auth.getSession();
    const user = await supabase.auth.getUser();
    const jwt = session.data.session?.access_token;

    const sessionInfo = {
      phase,
      authenticated: !!session.data.session?.user,
      userId: session.data.session?.user?.id || 'null',
      email: session.data.session?.user?.email || 'null',
      getUser: user.data?.user?.id || 'null',
    };

    console.log(`[SESSION AUDIT] ${phase}:`, sessionInfo);

    if (jwt) {
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        console.log(`[SESSION AUDIT] JWT Claims:`, {
          sub: payload.sub,
          role: payload.role,
          aud: payload.aud,
          exp: new Date(payload.exp * 1000).toISOString(),
        });
      } catch (e) {
        console.log('[SESSION AUDIT] Could not decode JWT');
      }
    }

    return sessionInfo;
  };

  const testRLSQuery = async (phase: string, isAuthenticated: boolean) => {
    console.log(`[RLS TEST] Phase: ${phase}, Authenticated: ${isAuthenticated}`);

    try {
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('id, email')
        .limit(1);

      if (error) {
        console.error(`[RLS TEST] ${phase} - ANON SELECT failed:`, {
          status,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log(`[RLS TEST] ${phase} - ANON SELECT succeeded:`, {
          count: data?.length || 0,
          firstRecord: data?.[0] || null,
        });
      }
    } catch (e) {
      console.error(`[RLS TEST] ${phase} - Exception:`, e);
    }
  };

  const testAuthenticatedRLSQuery = async (phase: string, userId: string) => {
    console.log(`[RLS TEST] Phase: ${phase}, Testing authenticated access for user: ${userId}`);

    try {
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error(`[RLS TEST] ${phase} - AUTH SELECT failed:`, {
          status,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log(`[RLS TEST] ${phase} - AUTH SELECT succeeded:`, {
          found: !!data,
          id: data?.id || null,
          email: data?.email || null,
        });
      }
    } catch (e) {
      console.error(`[RLS TEST] ${phase} - Exception:`, e);
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[LOGIN] Attempt for:', normalizedEmail);

    try {
      // Step 1: Check login attempts and account lock status
      console.log('[LOGIN] Checking login attempts...');
      const { data: loginRecord, error: checkError } = await supabase
        .from('login_attempts')
        .select('failed_attempts, locked_until')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (checkError) {
        console.error('[LOGIN] Error checking login attempts:', checkError);
      }

      // Check if account is locked
      if (loginRecord?.locked_until) {
        const lockExpires = new Date(loginRecord.locked_until);
        if (lockExpires > new Date()) {
          console.log('[LOGIN] Account locked until:', lockExpires);
          throw new Error('Invalid credentials');
        }
        console.log('[LOGIN] Lock expired, resetting...');
      }

      // Step 2: Pre-registration check (verify user exists)
      console.log('[LOGIN] Verifying email registration...');
      const { data: preRegData, error: preRegError } = await supabase
        .from('user_profiles')
        .select('id, force_password_reset')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (preRegError) {
        console.error('[LOGIN] Pre-registration check error:', preRegError);
        throw new Error('Invalid credentials');
      }

      if (!preRegData) {
        console.log('[LOGIN] Email not registered');
        throw new Error('Invalid credentials');
      }

      // Step 3: Attempt authentication
      console.log('[LOGIN] Attempting authentication...');
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        console.log('[LOGIN] Authentication failed:', authError.code);

        // Increment failed attempts
        const newFailedAttempts = (loginRecord?.failed_attempts || 0) + 1;
        const isLocked = newFailedAttempts >= 3;
        const lockedUntil = isLocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

        // Upsert login attempt record
        await supabase
          .from('login_attempts')
          .upsert(
            {
              email: normalizedEmail,
              failed_attempts: newFailedAttempts,
              locked_until: lockedUntil,
              last_attempt_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );

        if (isLocked) {
          console.log('[LOGIN] Account locked for 15 minutes');
        }

        throw new Error('Invalid credentials');
      }

      // Step 4: Authentication successful - reset failed attempts
      console.log('[LOGIN] Authentication successful');
      await supabase
        .from('login_attempts')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('email', normalizedEmail);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        supabase
          .from('user_login_history')
          .insert({ user_id: currentSession.user.id, email: normalizedEmail })
          .then(({ error: lhErr }) => {
            if (lhErr) console.error('[LOGIN] Failed to record login history:', lhErr);
          });
      }

      // Step 5: Wait for session and load user data
      await new Promise(r => setTimeout(r, 500));
      await getSessionInfo('AFTER_SIGNIN');

      // Store force_password_reset flag in session storage for post-login handling
      sessionStorage.setItem('forcePasswordReset', preRegData.force_password_reset ? 'true' : 'false');
    } catch (error) {
      console.error('[LOGIN] Error:', error instanceof Error ? error.message : error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data: preRegData, error: preRegError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (preRegError) throw preRegError;
    if (!preRegData) throw new Error('This email is not registered. Please contact your administrator.');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', data.user.id);

      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    stopPresenceTracking();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    localStorage.removeItem('lastRoute');
    localStorage.removeItem('salesDataEdit');
    localStorage.removeItem('viewSalesDataEdit');
  };

  const hasPermission = (permission: string): boolean => {
    const has = accessContext?.permissions.includes(permission) ?? false;
    console.log('[RBAC AUDIT] hasPermission("%s"):', permission, has);
    return has;
  };

  const getServiceCentreId = (): string | null => {
    if (!accessContext) return null;

    if (accessContext.scopeType === 'SC' && accessContext.scopeId) {
      return accessContext.scopeId;
    }

    if (accessContext.allowedServiceCentreIds.length === 1) {
      return accessContext.allowedServiceCentreIds[0];
    }

    return null;
  };

  const refreshUserData = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        scopes,
        accessContext,
        loading,
        isActive,
        signIn,
        signUp,
        signOut,
        hasPermission,
        getServiceCentreId,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
