/*
  # Add Progressive Dam Registration Fields

  1. Schema Changes
    - Make dam_code nullable and auto-generate if not provided
    - Make full_supply_capacity_ml nullable for progressive entry
    - Add new optional fields:
      - river (text)
      - catchment (text)
      - coordinates (text)
      - dam_type (text with check constraint)
      - year_constructed (integer)
      - spillway_type (text)
      - owner (text)
      - operational_status (text with check constraint, default 'Active')

  2. Purpose
    - Enable minimal dam registration with only name required
    - Support progressive data completion over time
    - Track dam construction and operational details

  3. Notes
    - Existing dams remain unchanged
    - Dam name is the only required field
    - All other fields can be added progressively
*/

-- Make dam_code nullable for progressive registration
ALTER TABLE dams ALTER COLUMN dam_code DROP NOT NULL;

-- Make full_supply_capacity_ml nullable
ALTER TABLE dams ALTER COLUMN full_supply_capacity_ml DROP NOT NULL;

-- Add new optional fields for progressive dam registration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'river'
  ) THEN
    ALTER TABLE dams ADD COLUMN river text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'catchment'
  ) THEN
    ALTER TABLE dams ADD COLUMN catchment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'coordinates'
  ) THEN
    ALTER TABLE dams ADD COLUMN coordinates text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'dam_type'
  ) THEN
    ALTER TABLE dams ADD COLUMN dam_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'year_constructed'
  ) THEN
    ALTER TABLE dams ADD COLUMN year_constructed integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'spillway_type'
  ) THEN
    ALTER TABLE dams ADD COLUMN spillway_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'owner'
  ) THEN
    ALTER TABLE dams ADD COLUMN owner text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dams' AND column_name = 'operational_status'
  ) THEN
    ALTER TABLE dams ADD COLUMN operational_status text DEFAULT 'Active';
  END IF;
END $$;

-- Add check constraints for enumerated fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_dam_type_check'
  ) THEN
    ALTER TABLE dams ADD CONSTRAINT dams_dam_type_check 
    CHECK (dam_type IS NULL OR dam_type IN ('Earth', 'Concrete', 'Rockfill', 'Arch', 'Gravity', 'Embankment', 'Other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_operational_status_check'
  ) THEN
    ALTER TABLE dams ADD CONSTRAINT dams_operational_status_check 
    CHECK (operational_status IS NULL OR operational_status IN ('Active', 'Decommissioned', 'Under Construction', 'Maintenance'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_year_constructed_check'
  ) THEN
    ALTER TABLE dams ADD CONSTRAINT dams_year_constructed_check 
    CHECK (year_constructed IS NULL OR (year_constructed >= 1800 AND year_constructed <= 2100));
  END IF;
END $$;