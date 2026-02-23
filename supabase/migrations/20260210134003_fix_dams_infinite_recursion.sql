/*
  # Fix Dams Table Infinite Recursion

  ## Issue
  The UPDATE policy on the `dams` table has infinite recursion in its WITH CHECK clause.
  The clause was trying to query the `dams` table itself, causing error code 42P17.

  ## Changes
  1. Drop the problematic UPDATE policy
  2. Recreate it with a proper WITH CHECK clause that doesn't cause recursion
  
  ## Security
  - USING clause: Ensures users can only update dams within their scope
  - WITH CHECK clause: Ensures the updated dam still belongs to an accessible scope
  - No recursive queries that would cause infinite loops
*/

-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update dams by scope" ON dams;

-- Recreate UPDATE policy with proper WITH CHECK
CREATE POLICY "Authenticated users can update dams by scope"
  ON dams FOR UPDATE
  TO authenticated
  USING (
    -- Global Admin can update any dam
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
    -- SC-scoped users can update dams in their service centre
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
    )
    OR
    -- Catchment-scoped users can update dams in their catchment's service centres
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
  WITH CHECK (
    -- Global Admin can update to any scope
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
    -- SC-scoped users can only update to their own service centre or NULL
    (
      service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
      )
      OR service_centre_id IS NULL
    )
    OR
    -- Catchment-scoped users can update to any SC in their catchment or NULL
    (
      service_centre_id IN (
        SELECT sc.id FROM service_centres sc
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id
        WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
      )
      OR service_centre_id IS NULL
    )
  );
