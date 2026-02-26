/*
  # Create Equipment Vehicles Table

  Tracks fleet vehicles assigned to service centres, including registration,
  licensing, insurance, and condition details.

  1. New Tables
    - `equipment_vehicles`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, FK to service_centres) - vehicles belong to an SC, not a station
      - `number_plate` (text) - vehicle registration plate
      - `vehicle_type` (text) - e.g. Truck, Bakkie, Sedan, SUV, Motorcycle
      - `make` (text) - manufacturer / brand
      - `model` (text) - model name
      - `year_of_manufacture` (integer)
      - `engine_number` (text)
      - `chassis_number` (text)
      - `fuel_type` (text) - Diesel, Petrol
      - `transmission` (text) - Manual, Automatic
      - `odometer_km` (numeric) - current reading
      - `status` (text) - Runner or Non-Runner
      - `zinara_expiry` (date) - ZINARA licence expiry
      - `insurance_expiry` (date) - insurance expiry
      - `fitness_expiry` (date) - certificate of fitness expiry
      - `condition` (text) - Good, Fair, Poor, Decommissioned
      - `condition_comment` (text) - free text describing vehicle condition
      - `assigned_to` (text) - person / department assigned
      - `notes` (text) - general notes
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled
    - Scope-based access identical to other equipment tables

  3. Indexes
    - service_centre_id, zinara_expiry, status
*/

CREATE TABLE IF NOT EXISTS equipment_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  number_plate text NOT NULL DEFAULT '',
  vehicle_type text DEFAULT '',
  make text DEFAULT '',
  model text DEFAULT '',
  year_of_manufacture integer DEFAULT 0,
  engine_number text DEFAULT '',
  chassis_number text DEFAULT '',
  fuel_type text DEFAULT 'Diesel',
  transmission text DEFAULT 'Manual',
  odometer_km numeric DEFAULT 0,
  status text DEFAULT 'Runner',
  zinara_expiry date,
  insurance_expiry date,
  fitness_expiry date,
  condition text DEFAULT 'Good',
  condition_comment text DEFAULT '',
  assigned_to text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicles in scope"
  ON equipment_vehicles FOR SELECT TO authenticated
  USING (
    service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid() AND scope_type = 'SC'
      AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE POLICY "Authenticated users can insert vehicles in scope"
  ON equipment_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid() AND scope_type = 'SC'
      AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE POLICY "Authenticated users can update vehicles in scope"
  ON equipment_vehicles FOR UPDATE TO authenticated
  USING (
    service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid() AND scope_type = 'SC'
      AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  )
  WITH CHECK (
    service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid() AND scope_type = 'SC'
      AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE POLICY "Authenticated users can delete vehicles in scope"
  ON equipment_vehicles FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE INDEX IF NOT EXISTS idx_equipment_vehicles_sc ON equipment_vehicles(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_equipment_vehicles_zinara ON equipment_vehicles(zinara_expiry);
CREATE INDEX IF NOT EXISTS idx_equipment_vehicles_status ON equipment_vehicles(status);
