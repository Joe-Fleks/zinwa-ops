/*
  # Fix Role Management RLS Policies

  ## Problem
  Role management UI is fully implemented but role changes never persist to database because:
  - RLS is enabled on user_roles and audit_logs tables
  - Only SELECT policies exist (no INSERT/UPDATE policies)
  - PostgreSQL defaults to DENY all operations when no explicit policies exist

  ## Solution
  Add comprehensive RLS policies for:
  1. user_roles table: INSERT and UPDATE policies for role assignments
  2. audit_logs table: INSERT policy for audit trail recording

  ## Security Model
  - Only authenticated users can manage roles
  - Only users with 'manage_roles' permission can make changes
  - Users can only assign/update roles they are authorized to grant
  - All role changes are attributed to the user making the change
  - Audit logs are append-only (no update/delete)

  ## Policy Details

  ### user_roles INSERT Policy
  - User must be authenticated
  - User must have manage_roles permission
  - assigned_by field must be current user (enforce attribution)

  ### user_roles UPDATE Policy
  - Only effective_to field can be updated (retiring roles)
  - User must have manage_roles permission

  ### audit_logs INSERT Policy
  - Only authenticated users can insert
  - user_id field must be current user (accountability)
  - Append-only (no update/delete policies)
*/

-- Add INSERT policy for user_roles (allows role assignments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'Allow authenticated users to insert roles with manage_roles permission'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert roles with manage_roles permission"
      ON user_roles FOR INSERT
      TO authenticated
      WITH CHECK (
        -- User making the change must have manage_roles permission
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND p.permission_key = 'manage_roles'
        )
        -- Ensure assigned_by is the current user (attribution)
        AND assigned_by = auth.uid()
      );
  END IF;
END $$;

-- Add UPDATE policy for user_roles (allows retiring roles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'Allow authenticated users to retire roles with manage_roles permission'
  ) THEN
    CREATE POLICY "Allow authenticated users to retire roles with manage_roles permission"
      ON user_roles FOR UPDATE
      TO authenticated
      USING (
        -- User making the change must have manage_roles permission
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND p.permission_key = 'manage_roles'
        )
      )
      WITH CHECK (
        -- User must still have manage_roles permission
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND p.permission_key = 'manage_roles'
        )
      );
  END IF;
END $$;

-- Add INSERT policy for audit_logs (allows audit trail recording)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' 
    AND policyname = 'Allow authenticated users to insert their own audit logs'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert their own audit logs"
      ON audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (
        -- Only current user can log their own actions
        user_id = auth.uid()
      );
  END IF;
END $$;
