/*
  # Fix Infinite Recursion in user_roles RLS Policy

  1. Problem
    - user_roles SELECT policy contained recursive EXISTS clause
    - Queried user_roles table from within its own RLS evaluation
    - Caused PostgreSQL error 42P17: infinite recursion detected in policy
    - Blocked AdminUsers page and password change flow

  2. Solution
    - Simplify user_roles SELECT policy to remove recursive check
    - Policy now only checks: user owns the assignment OR user created it
    - Admin access control moved to application layer (hasPermission checks)
    - No policy on user_roles will query user_roles itself

  3. Changes
    - DROP existing "Admins can read all role assignments" policy
    - CREATE simplified policy without recursive EXISTS
    - Authenticated users can read:
      * Their own role assignments (user_id = auth.uid())
      * Assignments they created (assigned_by = auth.uid())

  4. Security Notes
    - RLS still prevents unauthorized access to role data
    - Admin-only page features still protected by application-layer hasPermission checks
    - No data leakage: policy enforces ownership/creator relationship
    - Application must validate admin status before showing admin UI
*/

DROP POLICY IF EXISTS "Admins can read all role assignments" ON user_roles;

CREATE POLICY "Users can read own role assignments"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR assigned_by = auth.uid());
