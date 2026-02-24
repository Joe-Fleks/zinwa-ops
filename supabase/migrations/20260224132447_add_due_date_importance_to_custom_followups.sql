/*
  # Upgrade Custom Follow-up Alerts Table

  ## Changes
  1. Add `due_date` column (date, optional) — allows users to set a deadline for a follow-up
  2. Add `importance` column (text, default 'Medium') — High, Medium, or Low priority
  3. Fix SELECT RLS policy to scope by `created_by = auth.uid()` so users only see their own follow-ups
     (Previously policy used USING (true) which showed all users' follow-ups)

  ## Security
  - DROP the old permissive SELECT policy
  - CREATE a new SELECT policy that enforces user ownership
*/

-- Add due_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_followup_alerts' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE custom_followup_alerts ADD COLUMN due_date date;
  END IF;
END $$;

-- Add importance column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_followup_alerts' AND column_name = 'importance'
  ) THEN
    ALTER TABLE custom_followup_alerts ADD COLUMN importance text NOT NULL DEFAULT 'Medium'
      CHECK (importance IN ('High', 'Medium', 'Low'));
  END IF;
END $$;

-- Drop old permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view custom followup alerts" ON custom_followup_alerts;

-- Create user-scoped SELECT policy
CREATE POLICY "Users can view their own custom followup alerts"
  ON custom_followup_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);
