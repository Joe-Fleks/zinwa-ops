/*
  # Fix Targets RLS Policies - Use scope_type Instead of system_rank

  ## Problem
  The SELECT policies on cw_production_targets, cw_sales_targets, and rw_sales_targets
  used incorrect system_rank checks:
  - Checked system_rank = 1 for national access, but Global Admin has system_rank = 100
  - Checked system_rank > 1 for SC/Catchment access, but all SC/Catchment roles have system_rank = 0
  - Result: no user could satisfy any condition, so all target queries returned zero rows

  ## Solution
  Replace system_rank checks with scope_type checks on user_roles:
  - NATIONAL scope_type = full access to all targets
  - SC scope_type = access to targets for stations in the user's service centre
  - CATCHMENT scope_type = access to targets for stations in the user's catchment

  ## Tables Affected
  1. cw_production_targets - DROP and recreate SELECT policy
  2. cw_sales_targets - DROP and recreate SELECT policy
  3. rw_sales_targets - DROP and recreate SELECT policy

  ## Security
  - Policies remain restrictive and scope-aware
  - No USING(true) policies
  - All policies require authenticated role
*/

-- Fix CW Production Targets SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view CW production targets by scope" ON cw_production_targets;

CREATE POLICY "Authenticated users can view CW production targets by scope"
  ON cw_production_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND ur.scope_type = 'NATIONAL'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND station_id IN (
        SELECT s.id FROM stations s
        JOIN user_roles ur ON s.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND station_id IN (
        SELECT s.id FROM stations s
        JOIN service_centres sc ON s.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- Fix CW Sales Targets SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view CW sales targets by scope" ON cw_sales_targets;

CREATE POLICY "Authenticated users can view CW sales targets by scope"
  ON cw_sales_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND ur.scope_type = 'NATIONAL'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND station_id IN (
        SELECT s.id FROM stations s
        JOIN user_roles ur ON s.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND station_id IN (
        SELECT s.id FROM stations s
        JOIN service_centres sc ON s.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- Fix RW Sales Targets SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view RW sales targets by scope" ON rw_sales_targets;

CREATE POLICY "Authenticated users can view RW sales targets by scope"
  ON rw_sales_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND ur.scope_type = 'NATIONAL'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND dam_id IN (
        SELECT d.id FROM dams d
        JOIN user_roles ur ON d.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND dam_id IN (
        SELECT d.id FROM dams d
        JOIN service_centres sc ON d.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );
