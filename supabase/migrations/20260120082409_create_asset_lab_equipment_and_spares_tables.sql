/*
  # Create Asset Register, Lab Equipment, and Spare Parts Tables

  1. New Tables
    
    ## `station_assets`
    - Asset register for station resources (motorbikes, bicycles, grass cutters, etc.)
    - `id` (uuid, primary key)
    - `station_id` (uuid, foreign key to stations)
    - `asset_type` (text) - Type of asset (e.g., Motorbike, Bicycle, Grass Cutter)
    - `asset_name` (text) - Name/description of the asset
    - `registration_number` (text) - For vehicles: plate number, for others: serial/asset number
    - `manufacturer` (text) - Manufacturer/brand
    - `model` (text) - Model information
    - `purchase_date` (date) - Date of purchase
    - `condition` (text) - Current condition (Good, Fair, Poor, Under Repair)
    - `notes` (text) - Additional notes
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    
    ## `lab_equipment`
    - Laboratory equipment for water quality testing
    - `id` (uuid, primary key)
    - `station_id` (uuid, foreign key to stations)
    - `equipment_name` (text) - Name of the equipment
    - `equipment_type` (text) - Type/category (e.g., pH Meter, Turbidity Meter, Chlorine Test Kit)
    - `manufacturer` (text) - Manufacturer/brand
    - `model` (text) - Model information
    - `serial_number` (text) - Serial number
    - `calibration_date` (date) - Last calibration date
    - `calibration_due_date` (date) - Next calibration due date
    - `condition` (text) - Current condition (Working, Needs Calibration, Under Repair, Not Working)
    - `notes` (text) - Additional notes
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    
    ## `spare_parts`
    - Inventory of spare parts for repairs
    - `id` (uuid, primary key)
    - `station_id` (uuid, foreign key to stations)
    - `part_name` (text) - Name of the spare part
    - `part_category` (text) - Category (e.g., Electrical, Mechanical, Plumbing)
    - `part_number` (text) - Part/catalog number
    - `quantity_in_stock` (integer) - Current quantity
    - `minimum_stock_level` (integer) - Minimum stock level for reordering
    - `unit_of_measure` (text) - Unit (e.g., pieces, meters, liters)
    - `supplier` (text) - Supplier name
    - `last_restock_date` (date) - Last restocking date
    - `notes` (text) - Additional notes
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all three tables
    - Add policies for authenticated users to manage their station data
*/

-- Create station_assets table
CREATE TABLE IF NOT EXISTS station_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  asset_type text,
  asset_name text,
  registration_number text,
  manufacturer text,
  model text,
  purchase_date date,
  condition text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE station_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view station assets"
  ON station_assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert station assets"
  ON station_assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update station assets"
  ON station_assets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete station assets"
  ON station_assets FOR DELETE
  TO authenticated
  USING (true);

-- Create lab_equipment table
CREATE TABLE IF NOT EXISTS lab_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  equipment_name text,
  equipment_type text,
  manufacturer text,
  model text,
  serial_number text,
  calibration_date date,
  calibration_due_date date,
  condition text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lab_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lab equipment"
  ON lab_equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lab equipment"
  ON lab_equipment FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lab equipment"
  ON lab_equipment FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lab equipment"
  ON lab_equipment FOR DELETE
  TO authenticated
  USING (true);

-- Create spare_parts table
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  part_name text,
  part_category text,
  part_number text,
  quantity_in_stock integer DEFAULT 0,
  minimum_stock_level integer DEFAULT 0,
  unit_of_measure text,
  supplier text,
  last_restock_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view spare parts"
  ON spare_parts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert spare parts"
  ON spare_parts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update spare parts"
  ON spare_parts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete spare parts"
  ON spare_parts FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_station_assets_station_id ON station_assets(station_id);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_station_id ON lab_equipment(station_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_station_id ON spare_parts(station_id);