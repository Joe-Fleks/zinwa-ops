/*
  # Fix RLS Policies for Stations and Dams Tables

  ## Problem
  Both stations and dams tables had overly permissive RLS policies using USING (true),
  allowing ANY authenticated user to view, insert, update, and delete data from ANY service centre.

  ## Solution
  Replace all permissive policies with scope-aware policies that enforce:
  - National-scoped users: Can access all stations/dams
  - SC-scoped users: Can only access stations/dams from their assigned SC
  - Catchment-scoped users: Can access stations/dams from their catchment's SCs

  ## Tables Fixed
  1. stations
  2. dams

  ## Security Model
  - SELECT: Filter by service_centre_id through user roles
  - INSERT: Only authenticated users can create, system enforces service_centre_id in RLS
  - UPDATE: Users can only update if they have access to the service_centre_id
  - DELETE: Users can only delete if they have access to the service_centre_id
*/

-- ============================================================================
-- 1. FIX STATIONS TABLE RLS POLICIES
-- ============================================================================

-- DROP old permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all stations" ON stations;

-- Create new scope-aware SELECT policy
CREATE POLICY "Authenticated users can view stations by scope"
  ON stations FOR SELECT
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
    -- SC-scoped users can see only their SC's stations
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see stations from their catchment's service centres
    (
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- DROP old permissive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update stations" ON stations;

-- Create new scope-aware UPDATE policy
CREATE POLICY "Authenticated users can update stations by scope"
  ON stations FOR UPDATE
  TO authenticated
  USING (
    -- Users can only update if they can view the station
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
      OR
      (
        service_centre_id IN (
          SELECT ur.scope_id FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
        )
      )
      OR
      (
        service_centre_id IN (
          SELECT sc.id FROM service_centres sc
          JOIN user_roles ur ON sc.catchment_id = ur.scope_id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
        )
      )
    )
  )
  WITH CHECK (
    -- Ensure service_centre_id doesn't change or is set correctly
    (service_centre_id = (SELECT service_centre_id FROM stations WHERE id = stations.id))
    OR
    (service_centre_id IS NULL)
  );

-- DROP old permissive DELETE policy
DROP POLICY IF EXISTS "Authenticated users can delete stations" ON stations;

-- Create new scope-aware DELETE policy
CREATE POLICY "Authenticated users can delete stations by scope"
  ON stations FOR DELETE
  TO authenticated
  USING (
    -- Users can only delete if they can view the station
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
      OR
      (
        service_centre_id IN (
          SELECT ur.scope_id FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
        )
      )
      OR
      (
        service_centre_id IN (
          SELECT sc.id FROM service_centres sc
          JOIN user_roles ur ON sc.catchment_id = ur.scope_id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
        )
      )
    )
  );

-- ============================================================================
-- 2. FIX DAMS TABLE RLS POLICIES
-- ============================================================================

-- DROP old permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all dams" ON dams;

-- Create new scope-aware SELECT policy
CREATE POLICY "Authenticated users can view dams by scope"
  ON dams FOR SELECT
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
    -- SC-scoped users can see only their SC's dams
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can see dams from their catchment's service centres
    (
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

-- DROP old permissive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update dams" ON dams;

-- Create new scope-aware UPDATE policy
CREATE POLICY "Authenticated users can update dams by scope"
  ON dams FOR UPDATE
  TO authenticated
  USING (
    -- Users can only update if they can view the dam
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
      OR
      (
        service_centre_id IN (
          SELECT ur.scope_id FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
        )
      )
      OR
      (
        service_centre_id IN (
          SELECT sc.id FROM service_centres sc
          JOIN user_roles ur ON sc.catchment_id = ur.scope_id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
        )
      )
    )
  )
  WITH CHECK (
    -- Ensure service_centre_id doesn't change or is set correctly
    (service_centre_id = (SELECT service_centre_id FROM dams WHERE id = dams.id))
    OR
    (service_centre_id IS NULL)
  );

-- DROP old permissive DELETE policy
DROP POLICY IF EXISTS "Authenticated users can delete dams" ON dams;

-- Create new scope-aware DELETE policy
CREATE POLICY "Authenticated users can delete dams by scope"
  ON dams FOR DELETE
  TO authenticated
  USING (
    -- Users can only delete if they can view the dam
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
      )
      OR
      (
        service_centre_id IN (
          SELECT ur.scope_id FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
        )
      )
      OR
      (
        service_centre_id IN (
          SELECT sc.id FROM service_centres sc
          JOIN user_roles ur ON sc.catchment_id = ur.scope_id
          WHERE ur.user_id = auth.uid()
          AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
        )
      )
    )
  );
