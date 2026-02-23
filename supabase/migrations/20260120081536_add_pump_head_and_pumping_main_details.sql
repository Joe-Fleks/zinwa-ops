/*
  # Add Pump Head and Pumping Main Details

  1. Changes to Tables
    - `pumps`
      - Add `pump_head_m` (numeric) - Pump head in meters
    
    - `pumping_stations`
      - Add `pumping_main_diameter` (text) - Diameter of pumping main (e.g., "150mm", "6 inch")
      - Add `pumping_main_distance_m` (numeric) - Distance of pumping main in meters
      - Add `pumping_main_material` (text) - Material type: PVC, AC, or GI

  2. Notes
    - All new fields are optional to support existing records
    - Fields allow for flexible data entry
*/

-- Add pump head to pumps table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pumps' AND column_name = 'pump_head_m'
  ) THEN
    ALTER TABLE pumps ADD COLUMN pump_head_m numeric;
  END IF;
END $$;

-- Add pumping main details to pumping_stations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pumping_stations' AND column_name = 'pumping_main_diameter'
  ) THEN
    ALTER TABLE pumping_stations ADD COLUMN pumping_main_diameter text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pumping_stations' AND column_name = 'pumping_main_distance_m'
  ) THEN
    ALTER TABLE pumping_stations ADD COLUMN pumping_main_distance_m numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pumping_stations' AND column_name = 'pumping_main_material'
  ) THEN
    ALTER TABLE pumping_stations ADD COLUMN pumping_main_material text;
  END IF;
END $$;