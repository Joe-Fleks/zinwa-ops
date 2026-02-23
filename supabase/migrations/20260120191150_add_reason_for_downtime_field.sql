/*
  # Add Reason for Downtime Field

  1. Changes
    - Add `reason_for_downtime` text field to `production_logs` table
    - This field will be used to document reasons for downtime incidents

  2. Purpose
    - Track and analyze reasons for station downtime
    - Improve operational decision making
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_logs' AND column_name = 'reason_for_downtime'
  ) THEN
    ALTER TABLE production_logs ADD COLUMN reason_for_downtime text;
  END IF;
END $$;
