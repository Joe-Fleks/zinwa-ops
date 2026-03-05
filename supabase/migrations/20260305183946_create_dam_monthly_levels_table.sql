/*
  # Create Dam Monthly Levels Table

  Stores monthly dam level readings used for RW NRW calculations.
  Each dam that has a full_supply_capacity_ml can have monthly level entries.
  The opening level for a year is entered manually; subsequent months' opening levels
  equal the previous month's closing level.

  1. New Tables
    - `dam_monthly_levels`
      - `id` (uuid, primary key)
      - `dam_id` (uuid, FK to dams, not null)
      - `year` (integer, not null)
      - `month` (integer, 1-12, not null)
      - `opening_level_ml` (numeric, >= 0) - Opening dam level in ML
      - `closing_level_ml` (numeric, >= 0) - Closing dam level in ML
      - `service_centre_id` (uuid, FK to service_centres)
      - `recorded_by` (uuid, FK to auth.users)
      - `created_at` / `updated_at` timestamps
      - Unique constraint on (dam_id, year, month)

  2. Security
    - Enable RLS on `dam_monthly_levels`
    - Scope-aware SELECT/INSERT/UPDATE/DELETE policies

  3. Indexes
    - Index on dam_id, year, month for efficient lookups
    - Index on service_centre_id for scope filtering
*/

CREATE TABLE IF NOT EXISTS dam_monthly_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id uuid NOT NULL REFERENCES dams(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  opening_level_ml numeric CHECK (opening_level_ml >= 0),
  closing_level_ml numeric CHECK (closing_level_ml >= 0),
  service_centre_id uuid REFERENCES service_centres(id) ON DELETE RESTRICT,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dam_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_dam_monthly_levels_dam ON dam_monthly_levels(dam_id);
CREATE INDEX IF NOT EXISTS idx_dam_monthly_levels_year_month ON dam_monthly_levels(year, month);
CREATE INDEX IF NOT EXISTS idx_dam_monthly_levels_sc ON dam_monthly_levels(service_centre_id);

ALTER TABLE dam_monthly_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dam monthly levels"
  ON dam_monthly_levels FOR SELECT
  TO authenticated
  USING (
    service_centre_id IS NULL
    OR service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type = 'SC'
      UNION
      SELECT sc2.id FROM user_roles ur2
      JOIN service_centres sc2 ON sc2.catchment_id = ur2.scope_id
      WHERE ur2.user_id = auth.uid()
        AND ur2.scope_type = 'CATCHMENT'
      UNION
      SELECT sc3.id FROM service_centres sc3
      WHERE EXISTS (
        SELECT 1 FROM user_roles ur3
        WHERE ur3.user_id = auth.uid()
          AND ur3.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can insert dam monthly levels"
  ON dam_monthly_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = recorded_by
    AND (
      service_centre_id IS NULL
      OR service_centre_id IN (
        SELECT ur.scope_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.scope_type = 'SC'
        UNION
        SELECT sc2.id FROM user_roles ur2
        JOIN service_centres sc2 ON sc2.catchment_id = ur2.scope_id
        WHERE ur2.user_id = auth.uid()
          AND ur2.scope_type = 'CATCHMENT'
        UNION
        SELECT sc3.id FROM service_centres sc3
        WHERE EXISTS (
          SELECT 1 FROM user_roles ur3
          WHERE ur3.user_id = auth.uid()
            AND ur3.scope_type = 'NATIONAL'
        )
      )
    )
  );

CREATE POLICY "Authenticated users can update dam monthly levels"
  ON dam_monthly_levels FOR UPDATE
  TO authenticated
  USING (
    service_centre_id IS NULL
    OR service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type = 'SC'
      UNION
      SELECT sc2.id FROM user_roles ur2
      JOIN service_centres sc2 ON sc2.catchment_id = ur2.scope_id
      WHERE ur2.user_id = auth.uid()
        AND ur2.scope_type = 'CATCHMENT'
      UNION
      SELECT sc3.id FROM service_centres sc3
      WHERE EXISTS (
        SELECT 1 FROM user_roles ur3
        WHERE ur3.user_id = auth.uid()
          AND ur3.scope_type = 'NATIONAL'
      )
    )
  )
  WITH CHECK (
    service_centre_id IS NULL
    OR service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type = 'SC'
      UNION
      SELECT sc2.id FROM user_roles ur2
      JOIN service_centres sc2 ON sc2.catchment_id = ur2.scope_id
      WHERE ur2.user_id = auth.uid()
        AND ur2.scope_type = 'CATCHMENT'
      UNION
      SELECT sc3.id FROM service_centres sc3
      WHERE EXISTS (
        SELECT 1 FROM user_roles ur3
        WHERE ur3.user_id = auth.uid()
          AND ur3.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can delete dam monthly levels"
  ON dam_monthly_levels FOR DELETE
  TO authenticated
  USING (
    service_centre_id IS NULL
    OR service_centre_id IN (
      SELECT ur.scope_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.scope_type = 'SC'
      UNION
      SELECT sc2.id FROM user_roles ur2
      JOIN service_centres sc2 ON sc2.catchment_id = ur2.scope_id
      WHERE ur2.user_id = auth.uid()
        AND ur2.scope_type = 'CATCHMENT'
      UNION
      SELECT sc3.id FROM service_centres sc3
      WHERE EXISTS (
        SELECT 1 FROM user_roles ur3
        WHERE ur3.user_id = auth.uid()
          AND ur3.scope_type = 'NATIONAL'
      )
    )
  );

DROP TRIGGER IF EXISTS update_dam_monthly_levels_updated_at ON dam_monthly_levels;
CREATE TRIGGER update_dam_monthly_levels_updated_at
  BEFORE UPDATE ON dam_monthly_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
