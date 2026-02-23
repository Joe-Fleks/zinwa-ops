/*
  # Create sales_records table

  1. New Tables
    - `sales_records`
      - `id` (uuid, primary key) - unique identifier
      - `station_id` (uuid, foreign key to stations) - the station this record belongs to
      - `year` (integer) - the year of the sales period
      - `month` (integer, 1-12) - the month of the sales period
      - `returns_volume_m3` (numeric, default 0) - sales volumes calculated from meter readings
      - `sage_sales_volume_m3` (numeric, default 0) - sales volumes obtained after billing
      - `billing_variance_percent` (numeric, generated) - calculated margin of error between returns and sage sales
      - `created_by` (uuid) - user who created the record
      - `created_at` (timestamptz, default now()) - creation timestamp
      - `updated_at` (timestamptz, default now()) - last update timestamp

  2. Constraints
    - Unique constraint on (station_id, year, month) to prevent duplicate entries
    - Month must be between 1 and 12
    - Year must be reasonable (2000-2100)

  3. Indexes
    - Index on (station_id, year, month) for fast lookups
    - Index on (year, month) for period filtering

  4. Security
    - Enable RLS on `sales_records` table
    - Authenticated users can select, insert, update, delete their scoped records
*/

CREATE TABLE IF NOT EXISTS sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  returns_volume_m3 numeric NOT NULL DEFAULT 0,
  sage_sales_volume_m3 numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_sales_records_station_period ON sales_records(station_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_records_period ON sales_records(year, month);

ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales records"
  ON sales_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = sales_records.station_id
    )
  );

CREATE POLICY "Authenticated users can insert sales records"
  ON sales_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = sales_records.station_id
    )
  );

CREATE POLICY "Authenticated users can update sales records"
  ON sales_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = sales_records.station_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = sales_records.station_id
    )
  );

CREATE POLICY "Authenticated users can delete sales records"
  ON sales_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = sales_records.station_id
    )
  );

CREATE OR REPLACE FUNCTION update_sales_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_records_updated_at
  BEFORE UPDATE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_records_updated_at();
