# COMPREHENSIVE RBAC SYSTEM AUDIT REPORT
**Date:** 2026-02-03
**Status:** CRITICAL ISSUES FOUND - SYSTEM BROKEN

---

## EXECUTIVE SUMMARY

The RBAC system refactor has introduced multiple critical errors:

1. **DATABASE SCHEMA MISMATCH** (CRITICAL)
   - `user_roles` table missing `scope_type` and `scope_id` columns
   - Code attempts to SELECT non-existent columns
   - Will cause runtime SQL errors

2. **TYPESCRIPT TYPE ERRORS** (7 Critical)
   - AuthContext role mapping creates invalid types
   - Permission data structure errors
   - Unresolved property references

3. **LOGICAL INCONSISTENCIES** (3 Found)
   - Dual scope storage: `user_scope` vs `user_roles`
   - maybeSingle() still used in utility functions
   - Scope type validation enum mismatch ('Catchment' vs 'CATCHMENT')

4. **ROUTING ERRORS** (1 Found)
   - Admin route missing from MainLayout

---

## DETAILED FINDINGS

### ISSUE #1: CRITICAL - MISSING DATABASE COLUMNS

**Location:** Database Schema - `user_roles` table

**Problem:**
- Original migration `20260131185352_create_user_roles_and_audit_tables.sql` creates `user_roles` WITHOUT scope columns
- Later migrations reference `scope_type` and `scope_id` but never add them
- Code in `AuthContext.tsx:178-186` tries to SELECT these non-existent columns

**Current Table Definition (Correct):**
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  effective_from timestamptz DEFAULT now(),
  effective_to timestamptz,
  assigned_by uuid,
  created_at timestamptz DEFAULT now()
  -- MISSING: scope_type, scope_id
);
```

**Code Attempting to Use (Broken):**
```typescript
.select(`
  id,
  role_id,
  scope_type,        // COLUMN DOES NOT EXIST
  scope_id,          // COLUMN DOES NOT EXIST
  roles!inner(...)
`)
```

**Impact:** Runtime SQL errors - queries will fail immediately

**Migration Required:** Add columns to user_roles table

---

### ISSUE #2: ARCHITECTURE CONFLICT - DUAL SCOPE STORAGE

**Location:** Database Schema - Two places storing scope

**Conflict:**
1. **`user_scope` table** (from migration 20260131185334)
   - Stores: user_id, scope_type, scope_id
   - UNIQUE constraint on (user_id, scope_type, scope_id)
   - Original design for scope assignment

2. **`user_roles` table** (from migration 20260131185352)
   - Originally had NO scope columns
   - Later code expects: scope_type, scope_id
   - Conflicting design

**Evidence:**
- `AdminUsers.tsx:77-89` queries `user_roles` for scope info
- `scopeUtils.ts:142-151` uses `getUserScopeInfo()` with maybeSingle()
- Two different approaches to same problem

**Impact:**
- Unclear which table is source of truth
- Redundant storage
- Inconsistent scope resolution

---

### ISSUE #3: CRITICAL - TYPESCRIPT ERRORS IN AUTHCONTEXT

**Location:** `src/contexts/AuthContext.tsx:205`

**Error:**
```typescript
const userRoles = userRolesData?.map(ur => ({
  ...ur.roles,
  scope_type: ur.scope_type,
  scope_id: ur.scope_id,
})).filter(Boolean) as UserRole[] || [];
// ^^^ Type casting error
```

**Problem:**
- Type says spreading `ur.roles` (which has id, name, description)
- Assigning to `UserRole[]` which requires all properties
- `ur.scope_type` and `ur.scope_id` come from user_roles join, not roles
- Properties are undefined if columns don't exist

**TypeScript Error:**
```
error TS2352: Conversion of type '{ scope_type: any; scope_id: any; length: number; ... }[]'
to type 'UserRole[]' may be a mistake because neither type sufficiently overlaps
with the other. Type '{ scope_type: any; scope_id: any; ... }' is missing the
following properties from type 'UserRole': id, name, description
```

---

### ISSUE #4: CRITICAL - PERMISSIONS DATA STRUCTURE ERROR

**Location:** `src/contexts/AuthContext.tsx:324`

**Error:**
```typescript
const permissions = permissionsData?.map(p => p.permissions.permission_key)
                                     // ^^^^^^^^^ This is wrong structure
```

**Problem:**
- Query selects:
  ```sql
  permission_id,
  permissions!inner(permission_key)
  ```
- Returns: `{ permission_id: string, permissions: { permission_key: string } }`
- Current code accesses: `p.permissions.permission_key` ✓ CORRECT
- But TypeScript thinks structure is different

**TypeScript Error:**
```
error TS2339: Property 'permission_key' does not exist
on type '{ permission_key: any; }[]'.
```

---

### ISSUE #5: MAYBESINGLE() STILL IN USE

**Location:** `src/lib/scopeUtils.ts:151`

**Code:**
```typescript
export async function getUserScopeInfo(userId: string): Promise<UserScopeInfo | null> {
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select(...)
    .eq('user_id', userId)
    .is('effective_to', null)
    .maybeSingle();  // ^^^^^^ SHOULD BE REMOVED
```

**Problem:**
- Scope refactor specified: "maybeSingle() MUST NOT be used for scope resolution"
- This function still uses it
- Limits to single row (inconsistent with new requirement)

**Also Used In:**
- `scopeUtils.ts:116` - fetchServiceCentreById
- `scopeUtils.ts:131` - fetchCatchmentById
- `AdminUsers.tsx:81` - catchment lookup
- `AdminUsers.tsx:88` - service centre lookup

---

### ISSUE #6: SCOPE TYPE ENUM MISMATCH

**Location:** Multiple files

**Inconsistency:**
- `user_scope` table CHECK constraint: `('SC', 'Catchment', 'National')`
- `ROLE_SCOPE_MATRIX` in rbacMatrix.ts: `'SC' | 'CATCHMENT' | 'NATIONAL'`
- `ScopeType` type definition: `'SC' | 'CATCHMENT' | 'NATIONAL'`

**Problem:**
Database allows: `'Catchment'` and `'National'`
Code expects: `'CATCHMENT'` and `'NATIONAL'`

**Impact:** Type mismatches if data is stored with wrong case

---

### ISSUE #7: MISSING ADMIN ROUTE

**Location:** `src/components/layout/MainLayout.tsx`

**Missing Routes:**
```typescript
// These routes do NOT exist:
<Route path="/admin" element={<Administration />} />
<Route path="/admin/users" element={<AdminUsers />} />
<Route path="/admin/roles" element={<RoleManagement />} />
<Route path="/admin/audit-logs" element={<AuditLogs />} />

// TopBar.tsx references: /admin
// Administration.tsx navigates to: /admin/users, /admin/roles, /admin/audit-logs
```

**Problem:**
- TopBar tries to navigate to `/admin`
- MainLayout doesn't define `/admin` route
- Will result in 404 when admin link clicked

---

### ISSUE #8: INCOMPLETE REFACTORING - DUAL SCOPE LOGIC

**Location:** Multiple files

**Problem:**
- `AuthContext.tsx` now uses `user_roles.scope_type/scope_id` (if they existed)
- `AdminUsers.tsx` still queries user_roles for scope
- `scopeUtils.ts:142-151` has separate `getUserScopeInfo()` using maybeSingle()
- No clear single source of truth

**Code Paths:**
1. **loadUserData (AuthContext):** Expects scope from user_roles
2. **AdminUsers:** Fetches scope from user_roles then looks up names
3. **getUserScopeInfo (scopeUtils):** Queries user_roles with maybeSingle()

---

## SUMMARY OF ALL ERRORS

| Issue | Severity | Type | Location | Fix |
|-------|----------|------|----------|-----|
| Missing scope columns in user_roles | CRITICAL | Schema | Database | Add migration to add columns |
| UserRole type casting error | CRITICAL | TypeScript | AuthContext.tsx:205 | Fix type mapping |
| Permissions data structure error | CRITICAL | TypeScript | AuthContext.tsx:324 | Fix data structure access |
| maybeSingle() still in use | HIGH | Logic | scopeUtils.ts:151 | Remove from utility |
| Scope type enum mismatch | HIGH | Data | Multiple files | Normalize to UPPERCASE |
| Missing admin routes | HIGH | Routing | MainLayout.tsx | Add route definitions |
| Dual scope storage | MEDIUM | Architecture | Database | Consolidate to single table |

---

## BUILD VERIFICATION

**Current Status:** ❌ FAILED

**TypeScript Errors:** 47+
- 7 in AuthContext.tsx (new from refactor)
- 6 in AdminUsers.tsx
- Multiple in other components (pre-existing)

**Runtime Errors:** Expected when code runs
- SQL queries will fail (missing columns)
- Admin routes will 404
- Scope resolution will break

---

## REQUIRED FIXES

### Priority 1 (CRITICAL - System Breaking)

1. **Add scope columns to user_roles table**
   - Create migration to add scope_type and scope_id columns
   - Add constraints and foreign keys

2. **Fix TypeScript role mapping**
   - Properly construct UserRole objects
   - Ensure all required properties present

3. **Fix permissions data access**
   - Correct the property access pattern

### Priority 2 (HIGH - Feature Breaking)

4. **Remove maybeSingle() from scope utilities**
   - Update getUserScopeInfo to not use maybeSingle()

5. **Normalize scope type enums**
   - Change database constraint to use uppercase
   - Ensure consistency across all files

6. **Add missing admin routes**
   - Add `/admin`, `/admin/users`, `/admin/roles`, `/admin/audit-logs` routes

### Priority 3 (MEDIUM - Architecture)

7. **Consolidate scope storage**
   - Decide: user_scope table OR user_roles columns
   - Remove redundant storage
   - Update all queries to use single source

---

## VALIDATION CHECKLIST

- [ ] Database migrations apply without errors
- [ ] TypeScript compilation succeeds (0 errors)
- [ ] All routes accessible without 404
- [ ] Authentication flow works end-to-end
- [ ] Admin module accessible with proper permissions
- [ ] Scope resolution deterministic (no maybeSingle)
- [ ] No SQL errors in browser console
- [ ] All admin functions operational
- [ ] Permission checks working correctly
- [ ] Build completes successfully

