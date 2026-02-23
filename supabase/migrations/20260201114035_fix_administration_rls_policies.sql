/*
  # Fix Administration Module RLS Policies

  1. User Profiles SELECT Policy
    - Previous: Only anon role could select (blocking authenticated users)
    - New: Authenticated users can read own profile OR admins can read all profiles
    - Impact: Unblocks AdminUsers page queries
    - Security: Restricted to self OR admin role check

  2. User Roles SELECT Policy
    - Previous: Any authenticated user could see all active role assignments
    - New: Only users can see own assignments OR admins can see all
    - Impact: Information disclosure vulnerability fixed
    - Security: Least privilege enforcement

  3. Audit Logs SELECT Policy
    - Previous: Checked for 'Admin' role only
    - New: Checks for both 'Admin' AND 'Global Admin' roles
    - Impact: Global Admins can now access audit logs
    - Security: Consistent with global admin capabilities

  All changes maintain data integrity and append-only audit log constraint.
*/

-- Drop and recreate user_profiles SELECT policy
DROP POLICY IF EXISTS "Anon can check profiles" ON user_profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Admin', 'Global Admin')
        AND ur.effective_to IS NULL
    )
  );

-- Drop and recreate user_roles SELECT policy #2 (the overly permissive one)
DROP POLICY IF EXISTS "Users can read all active role assignments (for admin)" ON user_roles;

CREATE POLICY "Admins can read all role assignments"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Admin', 'Global Admin')
        AND ur.effective_to IS NULL
    )
  );

-- Drop and recreate audit_logs SELECT policy for admins
DROP POLICY IF EXISTS "Admins can read all audit logs" ON audit_logs;

CREATE POLICY "Admins can read all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Admin', 'Global Admin')
        AND ur.effective_to IS NULL
    )
  );
