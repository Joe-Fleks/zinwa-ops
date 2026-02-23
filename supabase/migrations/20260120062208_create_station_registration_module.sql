/*
  # Create Station Registration Module

  1. New Tables
    - `stations`
      - `id` (uuid, primary key) - Unique identifier
      - `station_code` (text, unique) - Station code identifier
      - `station_name` (text, not null) - Name of the station (only required field)
      - `station_type` (text) - Full Treatment or Borehole
      - `operational_status` (text) - Active or Decommissioned
      - `design_capacity_m3_hr` (numeric) - Design capacity in m³/hr
      - `location_coordinates` (text) - GPS coordinates
      - `location_description` (text) - Location description
      - `commissioning_date` (date) - When station was commissioned
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_by` (uuid) - User who created the record

    - `pumping_stations`
      - `id` (uuid, primary key) - Unique identifier
      - `station_id` (uuid, FK) - Reference to stations table
      - `pumping_station_type` (text) - RW, CW, Mid-Booster, Booster
      - `description` (text) - Description of pumping station
      - `created_at` (timestamptz) - Record creation timestamp

    - `pumps`
      - `id` (uuid, primary key) - Unique identifier
      - `pumping_station_id` (uuid, FK) - Reference to pumping_stations table
      - `pump_type` (text) - Type of pump
      - `motor_kw_rating` (numeric) - Motor rating in kW
      - `motor_hp_rating` (numeric) - Motor rating in HP
      - `pump_design_flow_m3_hr` (numeric) - Design flow in m³/hr
      - `manufacturer` (text) - Pump manufacturer
      - `installation_date` (date) - Installation date
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp

    - `operators`
      - `id` (uuid, primary key) - Unique identifier
      - `station_id` (uuid, FK) - Reference to stations table
      - `full_name` (text) - Operator full name
      - `position` (text) - Job position
      - `employment_status` (text) - Active, Transferred, Retired, Resigned, Fired
      - `transfer_target_station_id` (uuid, FK, nullable) - Target station if transferred
      - `notes` (text) - Additional notes
      - `start_date` (date) - Employment start date
      - `created_at` (timestamptz) - Record creation timestamp

    - `treatment_units`
      - `id` (uuid, primary key) - Unique identifier
      - `station_id` (uuid, FK) - Reference to stations table
      - `rw_abstraction_type` (text) - Raw water abstraction type
      - `sedimentation_tank_size_m3` (numeric) - Tank size in m³
      - `filter_type` (text) - Type of filter
      - `filter_size` (text) - Filter size
      - `backwash_tank_size_m3` (numeric) - Backwash tank size in m³
      - `backwash_system_type` (text) - Type of backwash system
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp

    - `station_client_groups`
      - `id` (uuid, primary key) - Unique identifier
      - `station_id` (uuid, FK) - Reference to stations table
      - `category` (text) - Client category
      - `number_of_clients` (integer) - Number of clients
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage all records

  3. Indexes
    - Index on station_code for quick lookups
    - Foreign key indexes for all relationships
*/

-- Create stations table
CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_code text UNIQUE,
  station_name text NOT NULL,
  station_type text,
  operational_status text DEFAULT 'Active',
  design_capacity_m3_hr numeric,
  location_coordinates text,
  location_description text,
  commissioning_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create pumping_stations table
CREATE TABLE IF NOT EXISTS pumping_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  pumping_station_type text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create pumps table
CREATE TABLE IF NOT EXISTS pumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pumping_station_id uuid NOT NULL REFERENCES pumping_stations(id) ON DELETE CASCADE,
  pump_type text,
  motor_kw_rating numeric,
  motor_hp_rating numeric,
  pump_design_flow_m3_hr numeric,
  manufacturer text,
  installation_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  full_name text,
  position text,
  employment_status text DEFAULT 'Active',
  transfer_target_station_id uuid REFERENCES stations(id),
  notes text,
  start_date date,
  created_at timestamptz DEFAULT now()
);

-- Create treatment_units table
CREATE TABLE IF NOT EXISTS treatment_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  rw_abstraction_type text,
  sedimentation_tank_size_m3 numeric,
  filter_type text,
  filter_size text,
  backwash_tank_size_m3 numeric,
  backwash_system_type text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create station_client_groups table
CREATE TABLE IF NOT EXISTS station_client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  category text,
  number_of_clients integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stations_station_code ON stations(station_code);
CREATE INDEX IF NOT EXISTS idx_stations_operational_status ON stations(operational_status);
CREATE INDEX IF NOT EXISTS idx_pumping_stations_station_id ON pumping_stations(station_id);
CREATE INDEX IF NOT EXISTS idx_pumps_pumping_station_id ON pumps(pumping_station_id);
CREATE INDEX IF NOT EXISTS idx_operators_station_id ON operators(station_id);
CREATE INDEX IF NOT EXISTS idx_operators_employment_status ON operators(employment_status);
CREATE INDEX IF NOT EXISTS idx_treatment_units_station_id ON treatment_units(station_id);
CREATE INDEX IF NOT EXISTS idx_station_client_groups_station_id ON station_client_groups(station_id);

-- Enable RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pumping_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_client_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stations table
CREATE POLICY "Authenticated users can view all stations"
  ON stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stations"
  ON stations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update stations"
  ON stations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete stations"
  ON stations FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for pumping_stations table
CREATE POLICY "Authenticated users can view all pumping stations"
  ON pumping_stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pumping stations"
  ON pumping_stations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pumping stations"
  ON pumping_stations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete pumping stations"
  ON pumping_stations FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for pumps table
CREATE POLICY "Authenticated users can view all pumps"
  ON pumps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pumps"
  ON pumps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pumps"
  ON pumps FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete pumps"
  ON pumps FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for operators table
CREATE POLICY "Authenticated users can view all operators"
  ON operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert operators"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete operators"
  ON operators FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for treatment_units table
CREATE POLICY "Authenticated users can view all treatment units"
  ON treatment_units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert treatment units"
  ON treatment_units FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update treatment units"
  ON treatment_units FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete treatment units"
  ON treatment_units FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for station_client_groups table
CREATE POLICY "Authenticated users can view all client groups"
  ON station_client_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client groups"
  ON station_client_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client groups"
  ON station_client_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client groups"
  ON station_client_groups FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for stations updated_at
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at
  BEFORE UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();