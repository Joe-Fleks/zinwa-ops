/*
  # Add Poles Column to Equipment Motors Table

  Enhances electric motor specifications by adding a poles field to track motor speed characteristics.

  1. Schema Changes
    - Add `poles` column to `equipment_motors` table
      - Type: integer (2-pole or 4-pole motors are most common)
      - Default: NULL (allows existing records to remain valid)
      - Common values: 2, 4, 6, 8

  2. Notes
    - Motor poles determine synchronous speed: Speed (RPM) = (120 × Frequency) / Poles
    - 2-pole motors: ~3000 RPM (at 50Hz) or ~3600 RPM (at 60Hz)
    - 4-pole motors: ~1500 RPM (at 50Hz) or ~1800 RPM (at 60Hz)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_motors' AND column_name = 'poles'
  ) THEN
    ALTER TABLE equipment_motors ADD COLUMN poles integer;
  END IF;
END $$;