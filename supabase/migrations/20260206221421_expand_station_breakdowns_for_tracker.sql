/*
  # Expand station_breakdowns table for full breakdowns tracker

  1. Modified Tables
    - `station_breakdowns`
      - Added `job_card_no` (text) - job card reference number
      - Added `nature_of_breakdown` (text) - description of what broke
      - Added `possible_root_cause` (text) - suspected cause
      - Added `suggested_solutions` (text) - recommended fixes
      - Added `details_of_work` (text) - work carried out to resolve
      - Added `breakdown_impact` (text) - either 'Stopped pumping' or 'Not Significant'
      - Added `hours_lost` (numeric) - pumping hours lost due to the breakdown
      - Added `time_to_repair_days` (integer) - days taken to repair
      - Added `remarks` (text) - additional notes

  2. Notes
    - The `breakdown_impact` column replaces the old `impact` column for the UI
    - Default value for `breakdown_impact` is 'Not Significant'
    - NonFunctionalStations will check `breakdown_impact = 'Stopped pumping'` to flag stations
    - Old `impact` column is preserved (no destructive changes)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'job_card_no') THEN
    ALTER TABLE station_breakdowns ADD COLUMN job_card_no text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'nature_of_breakdown') THEN
    ALTER TABLE station_breakdowns ADD COLUMN nature_of_breakdown text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'possible_root_cause') THEN
    ALTER TABLE station_breakdowns ADD COLUMN possible_root_cause text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'suggested_solutions') THEN
    ALTER TABLE station_breakdowns ADD COLUMN suggested_solutions text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'details_of_work') THEN
    ALTER TABLE station_breakdowns ADD COLUMN details_of_work text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'breakdown_impact') THEN
    ALTER TABLE station_breakdowns ADD COLUMN breakdown_impact text NOT NULL DEFAULT 'Not Significant';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'hours_lost') THEN
    ALTER TABLE station_breakdowns ADD COLUMN hours_lost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'time_to_repair_days') THEN
    ALTER TABLE station_breakdowns ADD COLUMN time_to_repair_days integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'remarks') THEN
    ALTER TABLE station_breakdowns ADD COLUMN remarks text DEFAULT '';
  END IF;
END $$;
