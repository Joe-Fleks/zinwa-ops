/*
  # Create Raw Water Users and Allocations Tables

  ## Purpose
  This migration creates tables for the Raw Water (RW) Module to manage:
  - Water users/clients with contact and account information
  - Raw water allocation agreements linked to dams and users

  ## New Tables

  ### 1. `water_users`
  Stores information about raw water users/clients:
  - `user_id` (uuid, primary key) - Unique identifier
  - `station_id` (uuid, foreign key) - Links to stations table
  - `client_company_name` (text) - Client or company name
  - `national_id_no` (text) - National ID or company registration number
  - `account_no` (text, unique) - Account number for billing
  - `contact_1` (text) - Primary contact number
  - `contact_2` (text) - Secondary contact number
  - `email` (text) - Email address
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp
  - `created_by` (uuid) - User who created the record

  ### 2. `rw_allocations`
  Stores raw water allocation agreements:
  - `allocation_id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - Links to water_users
  - `station_id` (uuid, foreign key) - Links to stations table
  - `source` (text) - Source dam name (from dams table)
  - `farm_coordinates` (text) - Geographic coordinates
  - `property_name` (text) - Name of the property
  - `address` (text) - Physical address
  - `district` (text) - District location
  - `province` (text) - Province (defaults to 'Mash West')
  - `category` (text) - Category: A1, A2, Mine, Industry, Institution, Local Authority
  - `hectrage` (numeric) - Size of land in hectares
  - `crop` (text) - Type of crop being grown
  - `agreement_start_date` (date) - Agreement start date
  - `agreement_expiry_date` (date) - Agreement expiry date
  - `agreement_length_months` (integer) - Auto-calculated length in months
  - `water_allocated_ml` (numeric) - Water allocated in Mega Litres
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp
  - `created_by` (uuid) - User who created the record

  ## Security
  - Enable RLS on both tables
  - Policies for authenticated users to manage their station's data
  - Read access for authenticated users
  - Insert/Update/Delete require authentication

  ## Constraints
  - No duplicate account numbers in water_users
  - Agreement expiry must be after start date
  - Water allocated must be >= 0
  - Category must be one of allowed values
  - Email format validation
*/

-- Create water_users table
CREATE TABLE IF NOT EXISTS water_users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  client_company_name text NOT NULL,
  national_id_no text,
  account_no text UNIQUE NOT NULL,
  contact_1 text,
  contact_2 text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' OR email IS NULL),
  CONSTRAINT client_name_not_empty CHECK (length(trim(client_company_name)) > 0),
  CONSTRAINT account_no_not_empty CHECK (length(trim(account_no)) > 0)
);

-- Create rw_allocations table
CREATE TABLE IF NOT EXISTS rw_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES water_users(user_id) ON DELETE CASCADE,
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  source text,
  farm_coordinates text,
  property_name text,
  address text,
  district text,
  province text DEFAULT 'Mash West',
  category text,
  hectrage numeric(10, 2),
  crop text,
  agreement_start_date date,
  agreement_expiry_date date,
  agreement_length_months integer,
  water_allocated_ml numeric(10, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT valid_category CHECK (
    category IN ('A1', 'A2', 'Mine', 'Industry', 'Institution', 'Local Authority')
  ),
  CONSTRAINT valid_dates CHECK (
    agreement_expiry_date IS NULL OR 
    agreement_start_date IS NULL OR 
    agreement_expiry_date >= agreement_start_date
  ),
  CONSTRAINT valid_water_allocated CHECK (water_allocated_ml >= 0),
  CONSTRAINT valid_hectrage CHECK (hectrage IS NULL OR hectrage >= 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_water_users_station ON water_users(station_id);
CREATE INDEX IF NOT EXISTS idx_water_users_account ON water_users(account_no);
CREATE INDEX IF NOT EXISTS idx_water_users_client_name ON water_users(client_company_name);
CREATE INDEX IF NOT EXISTS idx_rw_allocations_user ON rw_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_rw_allocations_station ON rw_allocations(station_id);
CREATE INDEX IF NOT EXISTS idx_rw_allocations_category ON rw_allocations(category);
CREATE INDEX IF NOT EXISTS idx_rw_allocations_dates ON rw_allocations(agreement_start_date, agreement_expiry_date);

-- Enable Row Level Security
ALTER TABLE water_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for water_users table
CREATE POLICY "Users can view water users"
  ON water_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert water users"
  ON water_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update water users"
  ON water_users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete water users"
  ON water_users FOR DELETE
  TO authenticated
  USING (true);

-- Policies for rw_allocations table
CREATE POLICY "Users can view allocations"
  ON rw_allocations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert allocations"
  ON rw_allocations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update allocations"
  ON rw_allocations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete allocations"
  ON rw_allocations FOR DELETE
  TO authenticated
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_water_users_updated_at ON water_users;
CREATE TRIGGER update_water_users_updated_at
  BEFORE UPDATE ON water_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rw_allocations_updated_at ON rw_allocations;
CREATE TRIGGER update_rw_allocations_updated_at
  BEFORE UPDATE ON rw_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-calculate agreement length in months
CREATE OR REPLACE FUNCTION calculate_agreement_length()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agreement_start_date IS NOT NULL AND NEW.agreement_expiry_date IS NOT NULL THEN
    NEW.agreement_length_months = EXTRACT(YEAR FROM AGE(NEW.agreement_expiry_date, NEW.agreement_start_date)) * 12 +
                                   EXTRACT(MONTH FROM AGE(NEW.agreement_expiry_date, NEW.agreement_start_date));
  ELSE
    NEW.agreement_length_months = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate agreement length
DROP TRIGGER IF EXISTS calculate_agreement_length_trigger ON rw_allocations;
CREATE TRIGGER calculate_agreement_length_trigger
  BEFORE INSERT OR UPDATE ON rw_allocations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_agreement_length();