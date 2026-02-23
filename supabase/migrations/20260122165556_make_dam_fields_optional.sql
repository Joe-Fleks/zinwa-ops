/*
  # Make Dam Fields Optional

  1. Changes
    - Remove NOT NULL constraint from dam_code field
    - Remove NOT NULL constraint from full_supply_capacity_ml field
    - Keep CHECK constraint but allow null values
    - Only name field remains required
  
  2. Reason
    - Allow users to register dams with minimal information
    - Optional fields can be filled in later as data becomes available
*/

-- Make dam_code nullable
ALTER TABLE dams 
  ALTER COLUMN dam_code DROP NOT NULL;

-- Make full_supply_capacity_ml nullable
ALTER TABLE dams 
  ALTER COLUMN full_supply_capacity_ml DROP NOT NULL;

-- Drop the old constraint and add a new one that allows null
ALTER TABLE dams 
  DROP CONSTRAINT IF EXISTS dams_full_supply_capacity_ml_check;

ALTER TABLE dams 
  ADD CONSTRAINT dams_full_supply_capacity_ml_check 
  CHECK (full_supply_capacity_ml IS NULL OR full_supply_capacity_ml > 0);
