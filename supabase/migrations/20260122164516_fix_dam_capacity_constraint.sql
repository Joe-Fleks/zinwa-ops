/*
  # Fix Dam Capacity Constraint to Allow NULL

  1. Problem
    - Current CHECK constraint on full_supply_capacity_ml requires value > 0
    - This prevents NULL values from being inserted
    - Blocks name-only dam registration

  2. Solution
    - Drop the existing constraint
    - Add new constraint that allows NULL OR value > 0
    - Enables progressive dam registration with name only

  3. Impact
    - Allows dams to be created without capacity information
    - Data can be added progressively over time
    - No impact on existing data
*/

-- Drop the existing constraint that blocks NULL values
ALTER TABLE dams DROP CONSTRAINT IF EXISTS dams_full_supply_capacity_ml_check;

-- Add new constraint that allows NULL or positive values
ALTER TABLE dams ADD CONSTRAINT dams_full_supply_capacity_ml_check 
  CHECK (full_supply_capacity_ml IS NULL OR full_supply_capacity_ml > 0);