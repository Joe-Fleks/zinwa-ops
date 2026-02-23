/*
  # Add FSC Field and Fix Dam Registration Constraints

  1. New Field
    - Add `fsc` (text, nullable) - Flow/Measuring Device field
    - This field stores the flow or measuring device identifier for the dam
    - Optional field that can be added progressively

  2. Constraint Fixes
    - Drop UNIQUE constraint on dam_code to allow multiple NULL values
    - Add UNIQUE constraint using filtered index (only unique when NOT NULL)
    - Add UNIQUE constraint on name to prevent duplicate dam names
    - This allows multiple dams to have NULL dam_code but enforces uniqueness when code is provided

  3. Purpose
    - Enable truly progressive dam registration with only name required
    - Allow multiple dams without codes while preventing duplicate codes
    - Prevent duplicate dam names in the system

  4. Notes
    - Existing dams remain unchanged
    - Dam name is the only truly required field
    - All other fields can be added progressively
*/

-- Add FSC field to dams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'fsc'
  ) THEN
    ALTER TABLE dams ADD COLUMN fsc text;
  END IF;
END $$;

-- Drop existing UNIQUE constraint on dam_code
ALTER TABLE dams DROP CONSTRAINT IF EXISTS dams_dam_code_key;

-- Create unique index on dam_code that only applies when dam_code IS NOT NULL
-- This allows multiple NULL values but ensures uniqueness for non-NULL values
DROP INDEX IF EXISTS idx_dams_dam_code_unique;
CREATE UNIQUE INDEX idx_dams_dam_code_unique ON dams (dam_code) WHERE dam_code IS NOT NULL;

-- Add unique constraint on dam name to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_name_unique'
  ) THEN
    ALTER TABLE dams ADD CONSTRAINT dams_name_unique UNIQUE (name);
  END IF;
END $$;
