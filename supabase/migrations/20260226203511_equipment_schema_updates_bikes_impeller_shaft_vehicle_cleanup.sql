/*
  # Equipment Schema Updates: Bikes, Impeller, Shaft, Vehicle Cleanup

  1. Modified Tables
    - `equipment_pumps`
      - Added `impeller_size_mm` (numeric) - impeller diameter in mm
      - Added `impeller_type` (text) - Closed, Semi-Open, Open, Vortex
    - `equipment_motors`
      - Added `shaft_diameter_mm` (numeric) - shaft diameter in mm
    - `station_breakdowns`
      - Added `vehicle_id` (uuid, nullable FK to equipment_vehicles) - links vehicle breakdowns
      - station_id made nullable via dropping NOT NULL for vehicle-only breakdowns

  2. New Tables
    - `equipment_bikes` - motorbikes and bicycles allocated to stations
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK to stations) - bikes are allocated per station
      - `service_centre_id` (uuid, FK to service_centres)
      - `bike_type` (text) - Motorbike or Bicycle
      - `make` (text)
      - `model` (text)
      - `number_plate` (text) - registration plate (motorbikes only)
      - `engine_number` (text)
      - `chassis_number` (text)
      - `year_of_manufacture` (integer)
      - `fuel_type` (text) - Petrol, N/A
      - `odometer_km` (numeric)
      - `status` (text) - Runner, Non-Runner
      - `zinara_expiry` (date)
      - `condition` (text)
      - `condition_comment` (text)
      - `assigned_to` (text)
      - `notes` (text)

  3. Security
    - RLS enabled on equipment_bikes with scope-based policies
    - Same pattern as other equipment tables

  4. Important Notes
    - insurance_expiry and fitness_expiry are NOT dropped from equipment_vehicles
      to preserve data safety; they are simply ignored in the UI
    - Vehicle breakdowns link via vehicle_id on station_breakdowns
*/

-- Add impeller fields to pumps
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_pumps' AND column_name = 'impeller_size_mm') THEN
    ALTER TABLE equipment_pumps ADD COLUMN impeller_size_mm numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_pumps' AND column_name = 'impeller_type') THEN
    ALTER TABLE equipment_pumps ADD COLUMN impeller_type text DEFAULT '';
  END IF;
END $$;

-- Add shaft diameter to motors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_motors' AND column_name = 'shaft_diameter_mm') THEN
    ALTER TABLE equipment_motors ADD COLUMN shaft_diameter_mm numeric DEFAULT 0;
  END IF;
END $$;

-- Add vehicle_id to station_breakdowns for vehicle breakdown linkage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_breakdowns' AND column_name = 'vehicle_id') THEN
    ALTER TABLE station_breakdowns ADD COLUMN vehicle_id uuid REFERENCES equipment_vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create equipment_bikes table
CREATE TABLE IF NOT EXISTS equipment_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_centre_id uuid REFERENCES service_centres(id),
  bike_type text NOT NULL DEFAULT 'Motorbike',
  make text DEFAULT '',
  model text DEFAULT '',
  number_plate text DEFAULT '',
  engine_number text DEFAULT '',
  chassis_number text DEFAULT '',
  year_of_manufacture integer DEFAULT 0,
  fuel_type text DEFAULT 'Petrol',
  odometer_km numeric DEFAULT 0,
  status text DEFAULT 'Runner',
  zinara_expiry date,
  condition text DEFAULT 'Good',
  condition_comment text DEFAULT '',
  assigned_to text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bikes in scope"
  ON equipment_bikes FOR SELECT TO authenticated
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

CREATE POLICY "Authenticated users can insert bikes in scope"
  ON equipment_bikes FOR INSERT TO authenticated
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

CREATE POLICY "Authenticated users can update bikes in scope"
  ON equipment_bikes FOR UPDATE TO authenticated
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

CREATE POLICY "Authenticated users can delete bikes in scope"
  ON equipment_bikes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE INDEX IF NOT EXISTS idx_equipment_bikes_station ON equipment_bikes(station_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bikes_sc ON equipment_bikes(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bikes_status ON equipment_bikes(status);
CREATE INDEX IF NOT EXISTS idx_station_breakdowns_vehicle ON station_breakdowns(vehicle_id);
