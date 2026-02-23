/*
  # Add 10% Yield Column to Dams Table

  1. New Columns
    - `ten_percent_yield_ml` (numeric) - 10% yield measurement in Mega Liters
  
  2. Notes
    - This represents the minimum sustainable yield (10% of full supply capacity)
    - Column is optional (nullable)
    - Can be manually entered or calculated from full capacity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dams' AND column_name = 'ten_percent_yield_ml'
  ) THEN
    ALTER TABLE dams ADD COLUMN ten_percent_yield_ml numeric;
  END IF;
END $$;