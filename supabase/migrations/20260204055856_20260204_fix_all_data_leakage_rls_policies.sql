/*
  # Comprehensive Fix for Data Leakage - All Tables

  ## CRITICAL ISSUES FOUND
  Multiple tables allowed ALL authenticated users to view ALL data:
  1. production_logs
  2. sales_logs
  3. rw_allocations
  4. water_users
  5. dam_monthly_capacities

  All used USING (true) policies - bypassing scope checks entirely.

  ## SOLUTION
  Replace all permissive SELECT policies with scope-aware policies that:
  - National-scoped users: Can see all data
  - Catchment-scoped users: Can see data from their catchment's service centres
  - SC-scoped users: Can see data only from their service centre

  ## Implementation Strategy
  For each table, the policy joins through stations → service_centres → catchments
  to verify the user's scope matches the data's scope.
*/

-- ============================================================================
-- 1. FIX PRODUCTION_LOGS RLS POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can read all production logs" ON production_logs;

CREATE POLICY "Authenticated users can read production logs by scope"
  ON production_logs FOR SELECT
  TO authenticated
  USING (
    -- National-scoped users can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- SC-scoped users can see only their SC's production logs
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND
      station_id IN (
        SELECT s.id FROM stations s
        JOIN user_roles ur ON s.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see logs from their catchment's service centres
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND
      station_id IN (
        SELECT s.id FROM stations s
        JOIN service_centres sc ON s.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- ============================================================================
-- 2. FIX SALES_LOGS RLS POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all sales logs" ON sales_logs;

CREATE POLICY "Authenticated users can view sales logs by scope"
  ON sales_logs FOR SELECT
  TO authenticated
  USING (
    -- National-scoped users can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- SC-scoped users can see only their SC's sales logs
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND
      station_id IN (
        SELECT s.id FROM stations s
        JOIN user_roles ur ON s.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see logs from their catchment's service centres
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND
      station_id IN (
        SELECT s.id FROM stations s
        JOIN service_centres sc ON s.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- ============================================================================
-- 3. FIX RW_ALLOCATIONS RLS POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Users can view allocations" ON rw_allocations;

CREATE POLICY "Users can view allocations by scope"
  ON rw_allocations FOR SELECT
  TO authenticated
  USING (
    -- National-scoped users can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- SC-scoped users can see only their SC's allocations
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see allocations from their catchment's service centres
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- ============================================================================
-- 4. FIX WATER_USERS RLS POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Users can view water users" ON water_users;

CREATE POLICY "Users can view water users by scope"
  ON water_users FOR SELECT
  TO authenticated
  USING (
    -- National-scoped users can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- SC-scoped users can see only their SC's water users
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see water users from their catchment's service centres
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- ============================================================================
-- 5. FIX DAM_MONTHLY_CAPACITIES RLS POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all capacity readings" ON dam_monthly_capacities;

CREATE POLICY "Authenticated users can view capacity readings by scope"
  ON dam_monthly_capacities FOR SELECT
  TO authenticated
  USING (
    -- National-scoped users can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- SC-scoped users can see only their SC's dam capacities
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      AND
      dam_id IN (
        SELECT d.id FROM dams d
        JOIN user_roles ur ON d.service_centre_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see capacities from their catchment's dams
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      AND
      dam_id IN (
        SELECT d.id FROM dams d
        JOIN service_centres sc ON d.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );
