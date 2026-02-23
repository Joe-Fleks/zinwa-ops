/*
  # Create Targets Management Tables

  ## Purpose
  Enable structured monthly and annual targets management for Clear Water (CW) 
  and Raw Water (RW) operations with full planning and performance analytics capability.

  ## New Tables
  
  ### 1. `cw_production_targets`
  Stores monthly production targets for each Clear Water station by year.
  - `id` (uuid, primary key)
  - `station_id` (uuid, foreign key to stations table)
  - `year` (integer, the target year)
  - `jan` through `dec` (numeric, monthly target values)
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on (station_id, year)

  ### 2. `cw_sales_targets`
  Stores monthly sales targets for each Clear Water station by year.
  Same structure as cw_production_targets.

  ### 3. `rw_sales_targets`
  Stores monthly raw water sales targets for each dam by year.
  - `id` (uuid, primary key)
  - `dam_id` (uuid, foreign key to dams table)
  - `year` (integer, the target year)
  - `jan` through `dec` (numeric, monthly target values)
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on (dam_id, year)

  ## Data Rules
  - All monthly values default to 0
  - No negative values allowed (enforced by CHECK constraints)
  - Numeric values only
  - Unique station/dam-year combinations

  ## Security
  - Enable RLS on all tables
  - Authenticated users can view all targets
  - Authenticated users can insert/update/delete targets
  - All operations require authentication
*/

-- Create CW Production Targets Table
CREATE TABLE IF NOT EXISTS cw_production_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  jan numeric(10,2) DEFAULT 0 CHECK (jan >= 0),
  feb numeric(10,2) DEFAULT 0 CHECK (feb >= 0),
  mar numeric(10,2) DEFAULT 0 CHECK (mar >= 0),
  apr numeric(10,2) DEFAULT 0 CHECK (apr >= 0),
  may numeric(10,2) DEFAULT 0 CHECK (may >= 0),
  jun numeric(10,2) DEFAULT 0 CHECK (jun >= 0),
  jul numeric(10,2) DEFAULT 0 CHECK (jul >= 0),
  aug numeric(10,2) DEFAULT 0 CHECK (aug >= 0),
  sep numeric(10,2) DEFAULT 0 CHECK (sep >= 0),
  oct numeric(10,2) DEFAULT 0 CHECK (oct >= 0),
  nov numeric(10,2) DEFAULT 0 CHECK (nov >= 0),
  dec numeric(10,2) DEFAULT 0 CHECK (dec >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(station_id, year)
);

-- Create CW Sales Targets Table
CREATE TABLE IF NOT EXISTS cw_sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  jan numeric(10,2) DEFAULT 0 CHECK (jan >= 0),
  feb numeric(10,2) DEFAULT 0 CHECK (feb >= 0),
  mar numeric(10,2) DEFAULT 0 CHECK (mar >= 0),
  apr numeric(10,2) DEFAULT 0 CHECK (apr >= 0),
  may numeric(10,2) DEFAULT 0 CHECK (may >= 0),
  jun numeric(10,2) DEFAULT 0 CHECK (jun >= 0),
  jul numeric(10,2) DEFAULT 0 CHECK (jul >= 0),
  aug numeric(10,2) DEFAULT 0 CHECK (aug >= 0),
  sep numeric(10,2) DEFAULT 0 CHECK (sep >= 0),
  oct numeric(10,2) DEFAULT 0 CHECK (oct >= 0),
  nov numeric(10,2) DEFAULT 0 CHECK (nov >= 0),
  dec numeric(10,2) DEFAULT 0 CHECK (dec >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(station_id, year)
);

-- Create RW Sales Targets Table
CREATE TABLE IF NOT EXISTS rw_sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id uuid NOT NULL REFERENCES dams(id) ON DELETE CASCADE,
  year integer NOT NULL,
  jan numeric(10,2) DEFAULT 0 CHECK (jan >= 0),
  feb numeric(10,2) DEFAULT 0 CHECK (feb >= 0),
  mar numeric(10,2) DEFAULT 0 CHECK (mar >= 0),
  apr numeric(10,2) DEFAULT 0 CHECK (apr >= 0),
  may numeric(10,2) DEFAULT 0 CHECK (may >= 0),
  jun numeric(10,2) DEFAULT 0 CHECK (jun >= 0),
  jul numeric(10,2) DEFAULT 0 CHECK (jul >= 0),
  aug numeric(10,2) DEFAULT 0 CHECK (aug >= 0),
  sep numeric(10,2) DEFAULT 0 CHECK (sep >= 0),
  oct numeric(10,2) DEFAULT 0 CHECK (oct >= 0),
  nov numeric(10,2) DEFAULT 0 CHECK (nov >= 0),
  dec numeric(10,2) DEFAULT 0 CHECK (dec >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dam_id, year)
);

-- Enable RLS
ALTER TABLE cw_production_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_sales_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CW Production Targets
CREATE POLICY "Authenticated users can view CW production targets"
  ON cw_production_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert CW production targets"
  ON cw_production_targets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update CW production targets"
  ON cw_production_targets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete CW production targets"
  ON cw_production_targets FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for CW Sales Targets
CREATE POLICY "Authenticated users can view CW sales targets"
  ON cw_sales_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert CW sales targets"
  ON cw_sales_targets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update CW sales targets"
  ON cw_sales_targets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete CW sales targets"
  ON cw_sales_targets FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for RW Sales Targets
CREATE POLICY "Authenticated users can view RW sales targets"
  ON rw_sales_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert RW sales targets"
  ON rw_sales_targets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update RW sales targets"
  ON rw_sales_targets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete RW sales targets"
  ON rw_sales_targets FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cw_production_targets_station_year ON cw_production_targets(station_id, year);
CREATE INDEX IF NOT EXISTS idx_cw_sales_targets_station_year ON cw_sales_targets(station_id, year);
CREATE INDEX IF NOT EXISTS idx_rw_sales_targets_dam_year ON rw_sales_targets(dam_id, year);
