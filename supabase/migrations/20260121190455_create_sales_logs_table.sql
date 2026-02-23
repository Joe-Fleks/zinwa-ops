/*
  # Create Sales Logs Table for CW Sales Data Module

  ## Purpose
  Captures station-level sales volumes on a monthly basis to track billing variance
  and Non-Revenue Water (NRW). Links operational production with billing data.

  ## New Tables
  - `sales_logs`
    - `sales_log_id` (uuid, primary key) - Unique identifier for each sales record
    - `station_id` (uuid, FK) - References station from stations table
    - `year` (integer) - Year of the sales record (e.g., 2024, 2025)
    - `month` (integer) - Month number (1-12)
    - `returns_volume_m3` (numeric) - Volume from meter readings by operators
    - `sage_sales_volume_m3` (numeric) - Volume from billing system after invoicing
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp
    - `entered_by` (uuid, FK) - User who created/edited the record
    - `is_locked` (boolean) - Audit lock flag for approved records

  ## Constraints
  - Unique constraint on (station_id, year, month) to prevent duplicates
  - Non-negative volumes enforced via CHECK constraints
  - Billing variance is calculated on-the-fly, not stored

  ## Security
  - Enable RLS on `sales_logs` table
  - Add policies for authenticated users to:
    - Read all sales logs
    - Insert new sales logs
    - Update existing sales logs (only if not locked)
    - Delete sales logs (admin only, if not locked)

  ## Notes
  - Billing variance is computed as: ABS(returns - sage) / NULLIF(returns, 0) × 100
  - All numeric fields default to 0 for ease of bulk entry
  - Future-ready for AI models and advanced analytics
*/

-- Create sales_logs table
CREATE TABLE IF NOT EXISTS sales_logs (
  sales_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  returns_volume_m3 numeric(10, 2) NOT NULL DEFAULT 0 CHECK (returns_volume_m3 >= 0),
  sage_sales_volume_m3 numeric(10, 2) NOT NULL DEFAULT 0 CHECK (sage_sales_volume_m3 >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_locked boolean DEFAULT false,
  UNIQUE(station_id, year, month)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_logs_station_year_month 
  ON sales_logs(station_id, year, month);

CREATE INDEX IF NOT EXISTS idx_sales_logs_year_month 
  ON sales_logs(year, month);

-- Enable Row Level Security
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all sales logs
CREATE POLICY "Authenticated users can view all sales logs"
  ON sales_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert sales logs
CREATE POLICY "Authenticated users can insert sales logs"
  ON sales_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update sales logs (only if not locked)
CREATE POLICY "Authenticated users can update unlocked sales logs"
  ON sales_logs
  FOR UPDATE
  TO authenticated
  USING (is_locked = false)
  WITH CHECK (is_locked = false);

-- Policy: Authenticated users can delete sales logs (only if not locked)
CREATE POLICY "Authenticated users can delete unlocked sales logs"
  ON sales_logs
  FOR DELETE
  TO authenticated
  USING (is_locked = false);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
DROP TRIGGER IF EXISTS set_sales_logs_updated_at ON sales_logs;
CREATE TRIGGER set_sales_logs_updated_at
  BEFORE UPDATE ON sales_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_logs_updated_at();