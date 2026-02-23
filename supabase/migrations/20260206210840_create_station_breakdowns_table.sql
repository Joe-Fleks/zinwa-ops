/*
  # Create station breakdowns table

  1. New Tables
    - `station_breakdowns`
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK -> stations) - the station experiencing the breakdown
      - `date_reported` (date) - when the breakdown was reported
      - `description` (text) - details of the breakdown
      - `impact` (text) - impact level: 'Stopping pumping', 'Reduced capacity', 'No impact'
      - `is_resolved` (boolean, default false) - whether the breakdown has been fixed
      - `date_resolved` (date, nullable) - when it was resolved
      - `resolved_by` (uuid, nullable) - who resolved it
      - `reported_by` (uuid) - who reported the breakdown
      - `service_centre_id` (uuid, FK -> service_centres)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `station_breakdowns` table
    - Authenticated users can select breakdowns in their scope
    - Authenticated users can insert breakdowns
    - Authenticated users can update breakdowns they reported or within their scope
    - Authenticated users can delete breakdowns they reported

  3. Indexes
    - Index on station_id + is_resolved for fast non-functional station lookups
    - Index on date_reported for date-range queries

  4. Notes
    - The `impact` field is used by the Non-functional Stations tab:
      breakdowns with impact = 'Stopping pumping' that are unresolved
      cause a station to appear as non-functional even if production
      volume exceeds the 25% threshold.
*/

CREATE TABLE IF NOT EXISTS station_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  date_reported date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  impact text NOT NULL DEFAULT 'No impact',
  is_resolved boolean NOT NULL DEFAULT false,
  date_resolved date,
  resolved_by uuid REFERENCES auth.users(id),
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_impact CHECK (
    impact IN ('Stopping pumping', 'Reduced capacity', 'No impact')
  )
);

ALTER TABLE station_breakdowns ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_station_breakdowns_station_resolved
  ON station_breakdowns(station_id, is_resolved)
  WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_station_breakdowns_date_reported
  ON station_breakdowns(date_reported);

CREATE INDEX IF NOT EXISTS idx_station_breakdowns_service_centre
  ON station_breakdowns(service_centre_id);

CREATE POLICY "Authenticated users can view breakdowns"
  ON station_breakdowns
  FOR SELECT
  TO authenticated
  USING (
    service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid()
        AND scope_type = 'SC'
        AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type IN ('CATCHMENT', 'NATIONAL')
        AND (ur.effective_to IS NULL OR ur.effective_to > now())
    )
  );

CREATE POLICY "Authenticated users can insert breakdowns"
  ON station_breakdowns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid()
        AND scope_type = 'SC'
        AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type IN ('CATCHMENT', 'NATIONAL')
        AND (ur.effective_to IS NULL OR ur.effective_to > now())
    )
  );

CREATE POLICY "Authenticated users can update breakdowns"
  ON station_breakdowns
  FOR UPDATE
  TO authenticated
  USING (
    reported_by = auth.uid()
    OR service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid()
        AND scope_type = 'SC'
        AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type IN ('CATCHMENT', 'NATIONAL')
        AND (ur.effective_to IS NULL OR ur.effective_to > now())
    )
  )
  WITH CHECK (
    reported_by = auth.uid()
    OR service_centre_id IN (
      SELECT scope_id FROM user_roles
      WHERE user_id = auth.uid()
        AND scope_type = 'SC'
        AND (effective_to IS NULL OR effective_to > now())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type IN ('CATCHMENT', 'NATIONAL')
        AND (ur.effective_to IS NULL OR ur.effective_to > now())
    )
  );

CREATE POLICY "Users can delete own breakdowns"
  ON station_breakdowns
  FOR DELETE
  TO authenticated
  USING (
    reported_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type IN ('CATCHMENT', 'NATIONAL')
        AND (ur.effective_to IS NULL OR ur.effective_to > now())
    )
  );
