/*
  # Fix infinite recursion in stations UPDATE policy

  1. Problem
    - The UPDATE policy WITH CHECK clause references the stations table itself
    - This triggers recursive RLS evaluation, causing "infinite recursion detected in policy" error
    - Users cannot save any updates to station records

  2. Fix
    - Drop the broken UPDATE policy
    - Recreate it with a WITH CHECK that mirrors the USING clause (scope-based access)
    - No self-referencing subquery needed

  3. Security
    - USING ensures user can only update stations in their scope
    - WITH CHECK ensures the updated row still belongs to a valid scope
*/

DROP POLICY IF EXISTS "Authenticated users can update stations by scope" ON stations;

CREATE POLICY "Authenticated users can update stations by scope"
  ON stations
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
    ))
    OR (service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
    ))
    OR (service_centre_id IN (
      SELECT sc.id FROM service_centres sc
      JOIN user_roles ur ON sc.catchment_id = ur.scope_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank = 1
    ))
    OR (service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'SC'
    ))
    OR (service_centre_id IN (
      SELECT sc.id FROM service_centres sc
      JOIN user_roles ur ON sc.catchment_id = ur.scope_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND ur.scope_type = 'CATCHMENT'
    ))
  );
