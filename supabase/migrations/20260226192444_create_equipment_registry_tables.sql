/*
  # Create Equipment Registry Tables

  Tracks pumping equipment specs, installation dates, and design life expiry.

  1. New Tables
    - `equipment_pumps` - pump specifications and lifecycle tracking
    - `equipment_motors` - electric motor specifications and lifecycle tracking
    - `equipment_bearings` - bearing specifications and lifecycle tracking

  2. Security
    - RLS enabled on all three tables
    - Scope-based access using user_roles.scope_type and scope_id
    - SC users see their SC data, Catchment/National users see all

  3. Indexes
    - station_id, service_centre_id, design_life_expiry on all tables
*/

CREATE TABLE IF NOT EXISTS equipment_pumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_centre_id uuid REFERENCES service_centres(id),
  tag_number text DEFAULT '',
  manufacturer text DEFAULT '',
  model text DEFAULT '',
  serial_number text DEFAULT '',
  pump_type text DEFAULT '',
  pump_use text DEFAULT '',
  duty_status text DEFAULT '',
  head_m numeric DEFAULT 0,
  flow_rate_m3_hr numeric DEFAULT 0,
  speed_rpm integer DEFAULT 0,
  stages integer DEFAULT 1,
  installation_date date,
  design_life_years integer DEFAULT 0,
  design_life_expiry date,
  condition text DEFAULT 'Good',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_pumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pumps in scope"
  ON equipment_pumps FOR SELECT TO authenticated
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

CREATE POLICY "Authenticated users can insert pumps in scope"
  ON equipment_pumps FOR INSERT TO authenticated
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

CREATE POLICY "Authenticated users can update pumps in scope"
  ON equipment_pumps FOR UPDATE TO authenticated
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

CREATE POLICY "Authenticated users can delete pumps in scope"
  ON equipment_pumps FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

-- Equipment Motors
CREATE TABLE IF NOT EXISTS equipment_motors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_centre_id uuid REFERENCES service_centres(id),
  tag_number text DEFAULT '',
  manufacturer text DEFAULT '',
  model text DEFAULT '',
  serial_number text DEFAULT '',
  motor_type text DEFAULT '',
  motor_use text DEFAULT '',
  duty_status text DEFAULT '',
  kw_rating numeric DEFAULT 0,
  hp_rating numeric DEFAULT 0,
  voltage numeric DEFAULT 0,
  current_amps numeric DEFAULT 0,
  speed_rpm integer DEFAULT 0,
  phase text DEFAULT 'Three Phase',
  enclosure_type text DEFAULT '',
  installation_date date,
  design_life_years integer DEFAULT 0,
  design_life_expiry date,
  condition text DEFAULT 'Good',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_motors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view motors in scope"
  ON equipment_motors FOR SELECT TO authenticated
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

CREATE POLICY "Authenticated users can insert motors in scope"
  ON equipment_motors FOR INSERT TO authenticated
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

CREATE POLICY "Authenticated users can update motors in scope"
  ON equipment_motors FOR UPDATE TO authenticated
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

CREATE POLICY "Authenticated users can delete motors in scope"
  ON equipment_motors FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

-- Equipment Bearings
CREATE TABLE IF NOT EXISTS equipment_bearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_centre_id uuid REFERENCES service_centres(id),
  tag_number text DEFAULT '',
  manufacturer text DEFAULT '',
  model text DEFAULT '',
  bearing_type text DEFAULT '',
  bearing_position text DEFAULT '',
  parent_equipment text DEFAULT '',
  parent_equipment_id uuid,
  parent_equipment_type text DEFAULT '',
  size_designation text DEFAULT '',
  installation_date date,
  design_life_years integer DEFAULT 0,
  design_life_expiry date,
  condition text DEFAULT 'Good',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_bearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bearings in scope"
  ON equipment_bearings FOR SELECT TO authenticated
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

CREATE POLICY "Authenticated users can insert bearings in scope"
  ON equipment_bearings FOR INSERT TO authenticated
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

CREATE POLICY "Authenticated users can update bearings in scope"
  ON equipment_bearings FOR UPDATE TO authenticated
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

CREATE POLICY "Authenticated users can delete bearings in scope"
  ON equipment_bearings FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND scope_type IN ('CATCHMENT', 'NATIONAL')
      AND (effective_to IS NULL OR effective_to > now())
    )
  );

CREATE INDEX IF NOT EXISTS idx_equipment_pumps_station ON equipment_pumps(station_id);
CREATE INDEX IF NOT EXISTS idx_equipment_pumps_sc ON equipment_pumps(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_equipment_pumps_expiry ON equipment_pumps(design_life_expiry);
CREATE INDEX IF NOT EXISTS idx_equipment_motors_station ON equipment_motors(station_id);
CREATE INDEX IF NOT EXISTS idx_equipment_motors_sc ON equipment_motors(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_equipment_motors_expiry ON equipment_motors(design_life_expiry);
CREATE INDEX IF NOT EXISTS idx_equipment_bearings_station ON equipment_bearings(station_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bearings_sc ON equipment_bearings(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bearings_expiry ON equipment_bearings(design_life_expiry);
