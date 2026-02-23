/*
  # Fix Data Leakage in Target Tables - Restrict RLS Policies

  ## Problem
  CW and RW target tables had overly permissive RLS policies:
  - All authenticated users could view ALL targets across ALL service centres
  - Policies used USING (true) which bypasses scope checking
  - SC-scoped users saw targets from other service centres
  - This violated data isolation requirements

  ## Solution
  Update RLS policies on target tables to enforce scope-based access:
  - Authenticated users can only view targets for their assigned scope
  - SC-scoped users: view only own SC targets
  - Catchment-scoped users: view only own catchment targets
  - National users: view all targets

  ## Tables Affected
  1. cw_production_targets
  2. cw_sales_targets
  3. rw_sales_targets
  4. rw_production_targets (if exists)

  ## Policy Changes
  - Drop old permissive SELECT policies (USING true)
  - Create new scope-aware SELECT policies
  - Filter by stations.service_centre_id through joins
*/

-- CW Production Targets - Fix SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view CW production targets" ON cw_production_targets;

CREATE POLICY "Authenticated users can view CW production targets by scope"
  ON cw_production_targets FOR SELECT
  TO authenticated
  USING (
    -- User is National scoped (can see all)
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- User is SC scoped - can see only own SC targets
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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
    -- User is Catchment scoped - can see targets from own catchment SCs
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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

-- CW Sales Targets - Fix SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view CW sales targets" ON cw_sales_targets;

CREATE POLICY "Authenticated users can view CW sales targets by scope"
  ON cw_sales_targets FOR SELECT
  TO authenticated
  USING (
    -- User is National scoped (can see all)
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- User is SC scoped - can see only own SC targets
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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
    -- User is Catchment scoped - can see targets from own catchment SCs
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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

-- RW Sales Targets - Fix SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view RW sales targets" ON rw_sales_targets;

CREATE POLICY "Authenticated users can view RW sales targets by scope"
  ON rw_sales_targets FOR SELECT
  TO authenticated
  USING (
    -- User is National scoped (can see all)
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND r.system_rank = 1
    )
    OR
    -- User is SC scoped - can see only own SC targets
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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
    -- User is Catchment scoped - can see targets from own catchment dams
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 1
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
