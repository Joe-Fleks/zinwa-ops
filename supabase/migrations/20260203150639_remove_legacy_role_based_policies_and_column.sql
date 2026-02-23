/*
  # Remove Legacy Role Column and Replace Role-Based Policies with RBAC

  ## Overview
  This migration removes the legacy user_profiles.role column and updates all RLS policies
  that were checking this column to use the new RBAC system instead.

  ## Context
  The system has migrated to RBAC (Role-Based Access Control) via:
  - user_roles table (maps users to roles)
  - roles table (defines role names)
  - role_permissions table (maps roles to permissions)

  Legacy RLS policies that checked user_profiles.role directly must be replaced with
  policies that check through user_roles → roles.name instead.

  ## Changes
  1. Drop legacy role-based RLS policies on 6 tables
  2. Create new RLS policies using RBAC system
  3. Drop the role column from user_profiles

  ## Tables Affected
  - clear_water_stations
  - station_daily_production
  - raw_water_dams
  - raw_water_users
  - raw_water_abstraction
  - alerts
*/

-- ============================================================================
-- 1. DROP LEGACY ROLE-BASED POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Operations managers and engineers can manage stations" ON clear_water_stations;
DROP POLICY IF EXISTS "Operations staff can manage production data" ON station_daily_production;
DROP POLICY IF EXISTS "Operations managers and engineers can manage dams" ON raw_water_dams;
DROP POLICY IF EXISTS "Operations managers and engineers can manage raw water users" ON raw_water_users;
DROP POLICY IF EXISTS "Operations staff can manage abstraction data" ON raw_water_abstraction;
DROP POLICY IF EXISTS "Operations managers can manage alerts" ON alerts;

-- ============================================================================
-- 2. CREATE NEW RBAC-BASED POLICIES
-- ============================================================================

-- clear_water_stations: Allow users with 'Engineer' or 'Operations Manager' roles
CREATE POLICY "Operations managers and engineers can manage stations"
  ON clear_water_stations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  );

-- station_daily_production: Allow users with 'Engineer', 'Operations Manager', or 'Standard User' roles
CREATE POLICY "Operations staff can manage production data"
  ON station_daily_production FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager', 'Standard User'])
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager', 'Standard User'])
        AND ur.effective_to IS NULL
    )
  );

-- raw_water_dams: Allow users with 'Engineer' or 'Operations Manager' roles
CREATE POLICY "Operations managers and engineers can manage dams"
  ON raw_water_dams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  );

-- raw_water_users: Allow users with 'Engineer' or 'Operations Manager' roles
CREATE POLICY "Operations managers and engineers can manage raw water users"
  ON raw_water_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager'])
        AND ur.effective_to IS NULL
    )
  );

-- raw_water_abstraction: Allow users with 'Engineer', 'Operations Manager', or 'Standard User' roles
CREATE POLICY "Operations staff can manage abstraction data"
  ON raw_water_abstraction FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager', 'Standard User'])
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY(ARRAY['Engineer', 'Operations Manager', 'Standard User'])
        AND ur.effective_to IS NULL
    )
  );

-- alerts: Allow users with 'Operations Manager' role only
CREATE POLICY "Operations managers can manage alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'Operations Manager'
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'Operations Manager'
        AND ur.effective_to IS NULL
    )
  );

-- ============================================================================
-- 3. DROP LEGACY ROLE COLUMN FROM user_profiles
-- ============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS role;
