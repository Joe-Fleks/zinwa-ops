/*
  # Add Distance from SC (km) column to stations

  1. Modified Tables
    - `stations`
      - Added `distance_from_sc_km` (integer, nullable) - distance from service centre in kilometres

  2. Notes
    - Replaces the text-based `location_description` column with a numeric distance field
    - Old `location_description` column is preserved but no longer used by the frontend
    - No data loss occurs as we are only adding a new column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'distance_from_sc_km'
  ) THEN
    ALTER TABLE stations ADD COLUMN distance_from_sc_km integer;
  END IF;
END $$;
