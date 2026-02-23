/*
  # Add Crop Category Column to RW Allocations

  1. Changes
    - Add `crop_category` column to `rw_allocations` table
    - Column is optional (nullable)
    - Positioned logically next to the `crop` field
    - Allows categorization of crops into predefined categories

  2. Approved Categories
    - Cereals
    - Horticulture
    - Plantations
    - Livestock
    - Aquaculture
    - Crocodile Farming
    - Tobacco/Cotton
    - Pasture/Lawn

  3. Notes
    - This column is optional and can be left blank
    - Existing records remain valid with NULL values
    - No data migration required - backward compatible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rw_allocations' AND column_name = 'crop_category'
  ) THEN
    ALTER TABLE rw_allocations ADD COLUMN crop_category text;
  END IF;
END $$;