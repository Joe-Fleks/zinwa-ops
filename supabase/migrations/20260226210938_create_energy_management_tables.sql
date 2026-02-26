/*
  # Create Energy Management Tables

  1. New Tables
    - `energy_meters`
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK to stations)
      - `service_centre_id` (uuid, FK to service_centres)
      - `meter_number` (text) - ZESA meter number
      - `meter_name` (text) - descriptive name
      - `account_number` (text) - ZESA account number
      - `tariff_rate_per_kwh` (numeric) - cost per kWh in local currency
      - `created_by`, `created_at`, `updated_at`

    - `energy_meter_equipment`
      - `id` (uuid, primary key)
      - `meter_id` (uuid, FK to energy_meters)
      - `motor_id` (uuid, FK to equipment_motors)
      - Links motors (with their kW ratings) to specific meters

    - `energy_bills`
      - `id` (uuid, primary key)
      - `meter_id` (uuid, FK to energy_meters)
      - `year` (integer), `month` (integer)
      - `actual_bill_amount` (numeric) - actual ZESA bill amount
      - `actual_kwh` (numeric) - actual kWh from bill
      - `notes` (text)

  2. Security
    - RLS enabled on all tables
    - Access based on user_roles scope_type/scope_id
*/

CREATE TABLE IF NOT EXISTS energy_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  meter_number text NOT NULL DEFAULT '',
  meter_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  tariff_rate_per_kwh numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE energy_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view energy meters"
  ON energy_meters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = energy_meters.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert energy meters"
  ON energy_meters FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = energy_meters.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can update energy meters"
  ON energy_meters FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = energy_meters.service_centre_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = energy_meters.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete energy meters"
  ON energy_meters FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (ur.scope_type = 'global' OR ur.scope_id = energy_meters.service_centre_id)
    )
  );

CREATE TABLE IF NOT EXISTS energy_meter_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  motor_id uuid NOT NULL REFERENCES equipment_motors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(meter_id, motor_id)
);

ALTER TABLE energy_meter_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meter equipment links"
  ON energy_meter_equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_meter_equipment.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert meter equipment links"
  ON energy_meter_equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_meter_equipment.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete meter equipment links"
  ON energy_meter_equipment FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_meter_equipment.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE TABLE IF NOT EXISTS energy_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  actual_bill_amount numeric NOT NULL DEFAULT 0,
  actual_kwh numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meter_id, year, month)
);

ALTER TABLE energy_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view energy bills"
  ON energy_bills FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_bills.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can insert energy bills"
  ON energy_bills FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_bills.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can update energy bills"
  ON energy_bills FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_bills.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_bills.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE POLICY "Authenticated users can delete energy bills"
  ON energy_bills FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM energy_meters em
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE em.id = energy_bills.meter_id
      AND (ur.scope_type = 'global' OR ur.scope_id = em.service_centre_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_energy_meters_station ON energy_meters(station_id);
CREATE INDEX IF NOT EXISTS idx_energy_meters_sc ON energy_meters(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_energy_meter_equipment_meter ON energy_meter_equipment(meter_id);
CREATE INDEX IF NOT EXISTS idx_energy_bills_meter_period ON energy_bills(meter_id, year, month);
