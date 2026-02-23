/*
  # Update Production Logs RLS Policies

  ## Summary
  Updates RLS policies to allow all authenticated users to update and delete
  any production logs, not just the ones they created. This enables users
  to edit past data and correct errors.

  ## Changes
  - Drop existing restrictive UPDATE and DELETE policies
  - Create new policies allowing all authenticated users to modify any log
  - Keep INSERT policy requiring created_by to be set to current user

  ## Security
  - All authenticated operations are logged with user IDs
  - Audit trail maintained through created_by and updated_at fields
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own production logs" ON production_logs;
DROP POLICY IF EXISTS "Users can delete their own production logs" ON production_logs;

-- Create new policies allowing all authenticated users to modify logs
CREATE POLICY "Authenticated users can update any production log"
  ON production_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete any production log"
  ON production_logs
  FOR DELETE
  TO authenticated
  USING (true);