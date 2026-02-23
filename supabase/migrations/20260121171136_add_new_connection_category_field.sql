/*
  # Add New Connection Category Field

  1. Changes
    - Add `new_connection_category` text field to `production_logs` table
    - This field will be used to categorize new connections (Residential, Commercial, Industrial, Institutional)

  2. Purpose
    - Track the type of new connections added
    - Enable better reporting and analysis of connection types
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_logs' AND column_name = 'new_connection_category'
  ) THEN
    ALTER TABLE production_logs ADD COLUMN new_connection_category text;
  END IF;
END $$;
