/*
  # Create Dams and Monthly Capacity Tracking Tables

  1. New Tables
    - `dams`
      - `id` (uuid, primary key) - Unique identifier for each dam
      - `dam_code` (text, unique, not null) - Unique code for the dam (e.g., "MUR-001")
      - `name` (text, not null) - Name of the dam
      - `full_supply_capacity_ml` (numeric, not null) - Maximum capacity in Mega Liters
      - `location` (text) - Optional location description
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_by` (uuid) - User who created the record
    
    - `dam_monthly_capacities`
      - `id` (uuid, primary key) - Unique identifier
      - `dam_id` (uuid, foreign key) - Reference to dams table
      - `month_year` (date, not null) - First day of the month (e.g., 2026-01-01)
      - `current_capacity_ml` (numeric, not null) - Current capacity in Mega Liters
      - `recorded_at` (timestamptz) - When this reading was recorded
      - `recorded_by` (uuid) - User who recorded this reading
      - `notes` (text) - Optional notes about the reading
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read all dams
    - Add policies for authenticated users to insert/update dams
    - Add policies for authenticated users to manage capacity readings
  
  3. Indexes
    - Index on dam_code for quick lookups
    - Index on dam_id and month_year for capacity queries
    - Unique constraint on dam_id + month_year to prevent duplicate entries
  
  4. Views
    - Create view to join dams with their capacity readings and calculate percentage
*/

-- Create dams table
CREATE TABLE IF NOT EXISTS dams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_code text UNIQUE NOT NULL,
  name text NOT NULL,
  full_supply_capacity_ml numeric NOT NULL CHECK (full_supply_capacity_ml > 0),
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create dam_monthly_capacities table
CREATE TABLE IF NOT EXISTS dam_monthly_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id uuid NOT NULL REFERENCES dams(id) ON DELETE CASCADE,
  month_year date NOT NULL,
  current_capacity_ml numeric NOT NULL CHECK (current_capacity_ml >= 0),
  recorded_at timestamptz DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  notes text,
  UNIQUE(dam_id, month_year)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dams_dam_code ON dams(dam_code);
CREATE INDEX IF NOT EXISTS idx_dam_monthly_capacities_dam_id ON dam_monthly_capacities(dam_id);
CREATE INDEX IF NOT EXISTS idx_dam_monthly_capacities_month_year ON dam_monthly_capacities(month_year);
CREATE INDEX IF NOT EXISTS idx_dam_monthly_capacities_dam_month ON dam_monthly_capacities(dam_id, month_year);

-- Enable RLS
ALTER TABLE dams ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_monthly_capacities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dams table
CREATE POLICY "Authenticated users can view all dams"
  ON dams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert dams"
  ON dams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update dams"
  ON dams FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete dams"
  ON dams FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for dam_monthly_capacities table
CREATE POLICY "Authenticated users can view all capacity readings"
  ON dam_monthly_capacities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert capacity readings"
  ON dam_monthly_capacities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Authenticated users can update capacity readings"
  ON dam_monthly_capacities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete capacity readings"
  ON dam_monthly_capacities FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for dams table
DROP TRIGGER IF EXISTS update_dams_updated_at ON dams;
CREATE TRIGGER update_dams_updated_at
  BEFORE UPDATE ON dams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for dam capacities with percentage calculations
CREATE OR REPLACE VIEW dam_capacity_view AS
SELECT 
  d.id,
  d.dam_code,
  d.name,
  d.full_supply_capacity_ml,
  d.location,
  d.created_at,
  d.updated_at,
  dmc.id as capacity_id,
  dmc.month_year,
  dmc.current_capacity_ml,
  ROUND((dmc.current_capacity_ml / d.full_supply_capacity_ml) * 100, 2) as percentage_full,
  dmc.recorded_at,
  dmc.recorded_by,
  dmc.notes
FROM dams d
LEFT JOIN dam_monthly_capacities dmc ON d.id = dmc.dam_id
ORDER BY d.name, dmc.month_year DESC;