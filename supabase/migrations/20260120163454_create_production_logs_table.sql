/*
  # Create Production Logs Table for CW Production Data

  ## Summary
  Creates a comprehensive production logging system for Clear Water (CW) operations
  to replace dummy data with real production metrics.

  ## New Tables
  - `production_logs`
    - `id` (uuid, primary key)
    - `station_id` (uuid, foreign key to stations)
    - `date` (date, production date)
    - `cw_volume_m3` (numeric, clear water volume produced)
    - `cw_hours_run` (numeric, clear water hours of operation)
    - `rw_volume_m3` (numeric, raw water volume abstracted)
    - `rw_hours_run` (numeric, raw water hours of operation)
    - `load_shedding_hours` (numeric, downtime due to power cuts)
    - `breakdown_hours` (numeric, downtime due to equipment failure)
    - `other_downtime_hours` (numeric, other downtime)
    - `alum_kg` (numeric, aluminum sulfate chemical used)
    - `hth_kg` (numeric, high test hypochlorite chemical used)
    - `activated_carbon_kg` (numeric, activated carbon used)
    - `new_connections` (integer, new water connections added)
    - `meters_serviced` (integer, meters serviced today)
    - `notes` (text, additional notes)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)
    - `created_by` (uuid, user who created the log)

  ## Indexes
  - Composite index on (station_id, date) for fast queries
  - Index on date for trend analysis

  ## Security
  - Enable RLS
  - Authenticated users can read all production logs
  - Authenticated users can insert new production logs
  - Users can update their own production logs
  - Users can delete their own production logs

  ## Constraints
  - Unique constraint on (station_id, date) to prevent duplicate entries
  - Check constraints to ensure non-negative values
*/

-- Create production_logs table
CREATE TABLE IF NOT EXISTS production_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  date date NOT NULL,
  cw_volume_m3 numeric DEFAULT 0 CHECK (cw_volume_m3 >= 0),
  cw_hours_run numeric DEFAULT 0 CHECK (cw_hours_run >= 0 AND cw_hours_run <= 24),
  rw_volume_m3 numeric DEFAULT 0 CHECK (rw_volume_m3 >= 0),
  rw_hours_run numeric DEFAULT 0 CHECK (rw_hours_run >= 0 AND rw_hours_run <= 24),
  load_shedding_hours numeric DEFAULT 0 CHECK (load_shedding_hours >= 0 AND load_shedding_hours <= 24),
  breakdown_hours numeric DEFAULT 0 CHECK (breakdown_hours >= 0 AND breakdown_hours <= 24),
  other_downtime_hours numeric DEFAULT 0 CHECK (other_downtime_hours >= 0 AND other_downtime_hours <= 24),
  alum_kg numeric DEFAULT 0 CHECK (alum_kg >= 0),
  hth_kg numeric DEFAULT 0 CHECK (hth_kg >= 0),
  activated_carbon_kg numeric DEFAULT 0 CHECK (activated_carbon_kg >= 0),
  new_connections integer DEFAULT 0 CHECK (new_connections >= 0),
  meters_serviced integer DEFAULT 0 CHECK (meters_serviced >= 0),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT unique_station_date UNIQUE(station_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_logs_station_date ON production_logs(station_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_production_logs_date ON production_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_production_logs_created_by ON production_logs(created_by);

-- Enable RLS
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read all production logs"
  ON production_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert production logs"
  ON production_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own production logs"
  ON production_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own production logs"
  ON production_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_production_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_production_logs_updated_at
  BEFORE UPDATE ON production_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_production_logs_updated_at();