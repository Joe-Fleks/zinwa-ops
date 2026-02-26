/*
  # Create Water Infrastructure Tables

  1. New Tables
    - `treatment_infrastructure`
      - Captures water treatment plant infrastructure per station
      - Tracks filter media dimensions, resanding dates, and schedules
      - Fields: filter_type, filter_count, filter_length_m, filter_width_m, filter_depth_m,
        media_type, media_depth_m, last_resanding_date, resanding_interval_months,
        next_resanding_date, estimated_media_qty_tonnes, sedimentation_tank_count,
        sedimentation_length_m, sedimentation_width_m, sedimentation_depth_m,
        clarifier_type, clarifier_count, clarifier_diameter_m, chemical_house_capacity,
        notes

    - `distribution_infrastructure`
      - Captures pumping mains and high level tanks per station
      - asset_type: 'Pumping Main' or 'High Level Tank'
      - For Pumping Mains: diameter_mm, length_km, material, pressure_class
      - For High Level Tanks: capacity_m3, tank_type, diameter_m, height_m
      - Common: year_installed, condition, notes

    - `distribution_network`
      - Captures reticulation network info per station
      - pipe_material, nominal_diameter_mm, length_km, pressure_class,
        installation_year, condition, area_served, notes

  2. Security
    - RLS enabled on all tables
    - Access restricted by service centre scope
*/

CREATE TABLE IF NOT EXISTS treatment_infrastructure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  component_type text NOT NULL DEFAULT 'Filter',
  component_name text NOT NULL DEFAULT '',
  filter_type text NOT NULL DEFAULT '',
  filter_count integer NOT NULL DEFAULT 0,
  filter_length_m numeric NOT NULL DEFAULT 0,
  filter_width_m numeric NOT NULL DEFAULT 0,
  filter_depth_m numeric NOT NULL DEFAULT 0,
  media_type text NOT NULL DEFAULT '',
  media_depth_m numeric NOT NULL DEFAULT 0,
  estimated_media_qty_tonnes numeric NOT NULL DEFAULT 0,
  last_resanding_date date,
  resanding_interval_months integer NOT NULL DEFAULT 60,
  next_resanding_date date,
  sedimentation_tank_count integer NOT NULL DEFAULT 0,
  sedimentation_length_m numeric NOT NULL DEFAULT 0,
  sedimentation_width_m numeric NOT NULL DEFAULT 0,
  sedimentation_depth_m numeric NOT NULL DEFAULT 0,
  clarifier_type text NOT NULL DEFAULT '',
  clarifier_count integer NOT NULL DEFAULT 0,
  clarifier_diameter_m numeric NOT NULL DEFAULT 0,
  chemical_house_capacity text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT 'Good',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE treatment_infrastructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view treatment infrastructure"
  ON treatment_infrastructure FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = treatment_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert treatment infrastructure"
  ON treatment_infrastructure FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = treatment_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can update treatment infrastructure"
  ON treatment_infrastructure FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = treatment_infrastructure.service_centre_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = treatment_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete treatment infrastructure"
  ON treatment_infrastructure FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = treatment_infrastructure.service_centre_id)
    )
  );

CREATE TABLE IF NOT EXISTS distribution_infrastructure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  asset_type text NOT NULL DEFAULT 'Pumping Main',
  asset_name text NOT NULL DEFAULT '',
  diameter_mm numeric NOT NULL DEFAULT 0,
  length_km numeric NOT NULL DEFAULT 0,
  material text NOT NULL DEFAULT '',
  pressure_class text NOT NULL DEFAULT '',
  capacity_m3 numeric NOT NULL DEFAULT 0,
  tank_type text NOT NULL DEFAULT '',
  tank_diameter_m numeric NOT NULL DEFAULT 0,
  height_m numeric NOT NULL DEFAULT 0,
  year_installed integer NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'Good',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE distribution_infrastructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view distribution infrastructure"
  ON distribution_infrastructure FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert distribution infrastructure"
  ON distribution_infrastructure FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can update distribution infrastructure"
  ON distribution_infrastructure FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_infrastructure.service_centre_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_infrastructure.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete distribution infrastructure"
  ON distribution_infrastructure FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_infrastructure.service_centre_id)
    )
  );

CREATE TABLE IF NOT EXISTS distribution_network (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  network_zone text NOT NULL DEFAULT '',
  pipe_material text NOT NULL DEFAULT '',
  nominal_diameter_mm numeric NOT NULL DEFAULT 0,
  length_km numeric NOT NULL DEFAULT 0,
  pressure_class text NOT NULL DEFAULT '',
  installation_year integer NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'Good',
  area_served text NOT NULL DEFAULT '',
  population_served integer NOT NULL DEFAULT 0,
  connections_count integer NOT NULL DEFAULT 0,
  has_prv boolean NOT NULL DEFAULT false,
  has_meter boolean NOT NULL DEFAULT false,
  leak_frequency text NOT NULL DEFAULT 'Low',
  last_maintenance_date date,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE distribution_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view distribution network"
  ON distribution_network FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_network.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert distribution network"
  ON distribution_network FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_network.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can update distribution network"
  ON distribution_network FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_network.service_centre_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_network.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete distribution network"
  ON distribution_network FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = distribution_network.service_centre_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_treatment_infra_station ON treatment_infrastructure(station_id);
CREATE INDEX IF NOT EXISTS idx_treatment_infra_sc ON treatment_infrastructure(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_distribution_infra_station ON distribution_infrastructure(station_id);
CREATE INDEX IF NOT EXISTS idx_distribution_infra_sc ON distribution_infrastructure(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_distribution_network_station ON distribution_network(station_id);
CREATE INDEX IF NOT EXISTS idx_distribution_network_sc ON distribution_network(service_centre_id);
