/*
  # Create Chemical Distribution Tables

  1. New Tables
    - `chemical_distributions`
      - `id` (uuid, primary key) - unique distribution record
      - `service_centre_id` (uuid, FK) - owning service centre
      - `chemical_type` (text) - aluminium_sulphate, hth, or activated_carbon
      - `distribution_date` (date) - when the distribution plan was created
      - `total_available_stock` (numeric) - total stock available for distribution
      - `target_equalization_days` (numeric) - the computed equalized days target
      - `variance_tolerance_pct` (numeric) - variance tolerance applied (5 or 10)
      - `created_by` (uuid) - user who created the distribution plan
      - `notes` (text) - optional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `chemical_distribution_items`
      - `id` (uuid, primary key) - unique line item
      - `distribution_id` (uuid, FK) - parent distribution record
      - `station_id` (uuid, FK) - target station
      - `current_balance_kg` (numeric) - station balance at time of calculation
      - `projected_daily_usage_kg` (numeric) - projected daily usage (target_hrs x design_cap x dosing_rate)
      - `days_remaining_before` (numeric) - days remaining before distribution
      - `allocated_kg` (numeric) - quantity allocated by the algorithm
      - `days_remaining_after` (numeric) - projected days remaining after distribution
      - `downtime_flagged` (boolean) - whether station was flagged for >50% downtime
      - `user_confirmed_rate_kg` (numeric, nullable) - user-confirmed daily rate if downtime flagged
      - `user_confirmed_offline_days` (integer, nullable) - days station will remain offline
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users scoped to their service centre
*/

CREATE TABLE IF NOT EXISTS chemical_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  chemical_type text NOT NULL CHECK (chemical_type IN ('aluminium_sulphate', 'hth', 'activated_carbon')),
  distribution_date date NOT NULL DEFAULT CURRENT_DATE,
  total_available_stock numeric NOT NULL DEFAULT 0,
  target_equalization_days numeric NOT NULL DEFAULT 0,
  variance_tolerance_pct numeric NOT NULL DEFAULT 5,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chemical_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view distributions in their service centre"
  ON chemical_distributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_id = chemical_distributions.service_centre_id
          OR ur.scope_type = 'CATCHMENT'
          OR ur.scope_type = 'NATIONAL'
        )
    )
  );

CREATE POLICY "Users can insert distributions in their service centre"
  ON chemical_distributions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_id = chemical_distributions.service_centre_id
          OR ur.scope_type = 'CATCHMENT'
          OR ur.scope_type = 'NATIONAL'
        )
    )
  );

CREATE POLICY "Users can update distributions in their service centre"
  ON chemical_distributions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_id = chemical_distributions.service_centre_id
          OR ur.scope_type = 'CATCHMENT'
          OR ur.scope_type = 'NATIONAL'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_id = chemical_distributions.service_centre_id
          OR ur.scope_type = 'CATCHMENT'
          OR ur.scope_type = 'NATIONAL'
        )
    )
  );

CREATE POLICY "Users can delete distributions in their service centre"
  ON chemical_distributions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_id = chemical_distributions.service_centre_id
          OR ur.scope_type = 'CATCHMENT'
          OR ur.scope_type = 'NATIONAL'
        )
    )
  );

CREATE TABLE IF NOT EXISTS chemical_distribution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES chemical_distributions(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES stations(id),
  current_balance_kg numeric NOT NULL DEFAULT 0,
  projected_daily_usage_kg numeric NOT NULL DEFAULT 0,
  days_remaining_before numeric NOT NULL DEFAULT 0,
  allocated_kg numeric NOT NULL DEFAULT 0,
  days_remaining_after numeric NOT NULL DEFAULT 0,
  downtime_flagged boolean NOT NULL DEFAULT false,
  user_confirmed_rate_kg numeric,
  user_confirmed_offline_days integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chemical_distribution_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view distribution items via parent"
  ON chemical_distribution_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chemical_distributions cd
      JOIN user_roles ur ON (
        ur.scope_id = cd.service_centre_id
        OR ur.scope_type = 'CATCHMENT'
        OR ur.scope_type = 'NATIONAL'
      )
      WHERE cd.id = chemical_distribution_items.distribution_id
        AND ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
    )
  );

CREATE POLICY "Users can insert distribution items via parent"
  ON chemical_distribution_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chemical_distributions cd
      JOIN user_roles ur ON (
        ur.scope_id = cd.service_centre_id
        OR ur.scope_type = 'CATCHMENT'
        OR ur.scope_type = 'NATIONAL'
      )
      WHERE cd.id = chemical_distribution_items.distribution_id
        AND ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
    )
  );

CREATE POLICY "Users can update distribution items via parent"
  ON chemical_distribution_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chemical_distributions cd
      JOIN user_roles ur ON (
        ur.scope_id = cd.service_centre_id
        OR ur.scope_type = 'CATCHMENT'
        OR ur.scope_type = 'NATIONAL'
      )
      WHERE cd.id = chemical_distribution_items.distribution_id
        AND ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chemical_distributions cd
      JOIN user_roles ur ON (
        ur.scope_id = cd.service_centre_id
        OR ur.scope_type = 'CATCHMENT'
        OR ur.scope_type = 'NATIONAL'
      )
      WHERE cd.id = chemical_distribution_items.distribution_id
        AND ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
    )
  );

CREATE POLICY "Users can delete distribution items via parent"
  ON chemical_distribution_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chemical_distributions cd
      JOIN user_roles ur ON (
        ur.scope_id = cd.service_centre_id
        OR ur.scope_type = 'CATCHMENT'
        OR ur.scope_type = 'NATIONAL'
      )
      WHERE cd.id = chemical_distribution_items.distribution_id
        AND ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_chemical_distributions_sc_type
  ON chemical_distributions(service_centre_id, chemical_type);

CREATE INDEX IF NOT EXISTS idx_chemical_distribution_items_dist_id
  ON chemical_distribution_items(distribution_id);

CREATE INDEX IF NOT EXISTS idx_chemical_distribution_items_station
  ON chemical_distribution_items(station_id);
