/*
  # Add Unique Constraint on Dam Name

  1. Purpose
    - Enforce dam name uniqueness across the system
    - Prevent duplicate dam registrations
    - Maintain data integrity

  2. Changes
    - Add UNIQUE constraint on dams.name column
    - Prevents multiple dams with identical names

  3. Impact
    - Database will reject attempts to create dams with duplicate names
    - Application will receive error that can be displayed to user
    - No impact on existing data if names are already unique
*/

-- Add unique constraint on dam name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_name_key'
  ) THEN
    ALTER TABLE dams ADD CONSTRAINT dams_name_key UNIQUE (name);
  END IF;
END $$;