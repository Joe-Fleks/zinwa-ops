/*
  # Fix INSERT RLS Policies for Stations and Dams

  ## Problem
  INSERT policies on stations and dams only checked if user is authenticated,
  but didn't enforce scope restrictions. Users could insert records with
  service_centre_ids they don't have access to.

  ## Solution
  Update INSERT policies to enforce:
  - SC-scoped users: Can only insert with their SC's service_centre_id
  - Catchment-scoped users: Can only insert with their catchment's SCs
  - National-scoped users: Can insert with any service_centre_id
*/

-- ============================================================================
-- 1. FIX STATIONS TABLE INSERT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert stations" ON stations;

CREATE POLICY "Authenticated users can insert stations by scope"
  ON stations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- National-scoped users can insert with any service_centre_id
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
    )
    OR
    -- SC-scoped users can only insert with their SC's service_centre_id
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can insert with their catchment's SCs
    (
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
    OR
    -- If service_centre_id is NULL, allow based on user's primary scope
    (
      service_centre_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
        )
      )
    )
  );

-- ============================================================================
-- 2. FIX DAMS TABLE INSERT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert dams" ON dams;

CREATE POLICY "Authenticated users can insert dams by scope"
  ON dams FOR INSERT
  TO authenticated
  WITH CHECK (
    -- National-scoped users can insert with any service_centre_id
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
    )
    OR
    -- SC-scoped users can only insert with their SC's service_centre_id
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can insert with their catchment's SCs
    (
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
    OR
    -- If service_centre_id is NULL, allow based on user's primary scope
    (
      service_centre_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
        )
      )
    )
  );
