/*
  # Add Target Daily Hours and Pump Rates to Stations

  1. Changes to Existing Tables
    - `stations`
      - Add `target_daily_hours` (numeric) - Target daily operating hours for the station
      - Add `rw_pump_rate_m3_hr` (numeric) - Raw water pump rate in m³/hr (calculated weekly from previous week's data)
      - Add `cw_pump_rate_m3_hr` (numeric) - Clear water pump rate in m³/hr (calculated weekly from previous week's data)
      - Add `pump_rates_last_updated` (timestamptz) - Timestamp of last pump rate calculation
  
  2. Notes
    - Target daily hours is editable by users to set operational targets
    - Pump rates are calculated automatically from production data (sum of volume / sum of hours run for previous week)
    - For borehole stations, rw_pump_rate_m3_hr will be NULL
    - Pump rates are updated weekly based on actual production performance
*/

-- Add new columns to stations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'target_daily_hours'
  ) THEN
    ALTER TABLE stations ADD COLUMN target_daily_hours numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'rw_pump_rate_m3_hr'
  ) THEN
    ALTER TABLE stations ADD COLUMN rw_pump_rate_m3_hr numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'cw_pump_rate_m3_hr'
  ) THEN
    ALTER TABLE stations ADD COLUMN cw_pump_rate_m3_hr numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'pump_rates_last_updated'
  ) THEN
    ALTER TABLE stations ADD COLUMN pump_rates_last_updated timestamptz;
  END IF;
END $$;