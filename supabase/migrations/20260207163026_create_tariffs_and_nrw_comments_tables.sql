/*
  # Create Tariffs and NRW Comments Tables

  1. New Tables
    - `tariffs`
      - `id` (uuid, primary key)
      - `tariff_type` (text) - 'CW' or 'RW'
      - `band_label` (text) - e.g. '1 - 10', '11 - 20', 'Above 50'
      - `band_min_m3` (numeric) - lower bound of consumption band
      - `band_max_m3` (numeric, nullable) - upper bound, NULL for unlimited
      - `tariff_usd_per_m3` (numeric) - tariff rate
      - `sort_order` (integer) - display ordering
      - `created_at`, `updated_at` (timestamptz)
      - `updated_by` (uuid, nullable)

    - `nrw_comments`
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK to stations)
      - `year` (integer)
      - `month` (integer)
      - `station_loss_comment` (text)
      - `distribution_loss_comment` (text)
      - `updated_by` (uuid, nullable)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Tariffs: all authenticated users can read, only CEO/Director/Global Admin can modify
    - NRW Comments: authenticated users can read, all authenticated can insert/update (edit comments)

  3. Seed Data
    - CW Tariff bands from Zinwa tariff schedule
    - RW Tariff bands (placeholder structure)
*/

-- Tariffs table
CREATE TABLE IF NOT EXISTS tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_type text NOT NULL CHECK (tariff_type IN ('CW', 'RW')),
  band_label text NOT NULL,
  band_min_m3 numeric NOT NULL DEFAULT 0,
  band_max_m3 numeric,
  tariff_usd_per_m3 numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tariffs
CREATE POLICY "Authenticated users can read tariffs"
  ON tariffs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only CEO, Director, Global Admin can insert tariffs
CREATE POLICY "Senior roles can insert tariffs"
  ON tariffs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.name IN ('CEO', 'Director', 'Global Admin')
    )
  );

-- Only CEO, Director, Global Admin can update tariffs
CREATE POLICY "Senior roles can update tariffs"
  ON tariffs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.name IN ('CEO', 'Director', 'Global Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.name IN ('CEO', 'Director', 'Global Admin')
    )
  );

-- Only CEO, Director, Global Admin can delete tariffs
CREATE POLICY "Senior roles can delete tariffs"
  ON tariffs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.name IN ('CEO', 'Director', 'Global Admin')
    )
  );

-- Seed CW tariff data
INSERT INTO tariffs (tariff_type, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', '1 - 10',    1,    10, 1.04, 1),
  ('CW', '11 - 20',   11,   20, 1.66, 2),
  ('CW', '21 - 30',   21,   30, 1.80, 3),
  ('CW', '31 - 40',   31,   40, 1.94, 4),
  ('CW', '41 - 50',   41,   50, 2.08, 5),
  ('CW', 'Above 50',  51, NULL, 2.15, 6);

-- Seed RW tariff data (placeholder rates)
INSERT INTO tariffs (tariff_type, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('RW', '1 - 100',      1,   100, 0.50, 1),
  ('RW', '101 - 500',  101,   500, 0.65, 2),
  ('RW', '501 - 1000', 501,  1000, 0.80, 3),
  ('RW', 'Above 1000', 1001, NULL, 0.95, 4);

-- NRW Comments table
CREATE TABLE IF NOT EXISTS nrw_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  station_loss_comment text NOT NULL DEFAULT '',
  distribution_loss_comment text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(station_id, year, month)
);

ALTER TABLE nrw_comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read NRW comments
CREATE POLICY "Authenticated users can read nrw comments"
  ON nrw_comments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- All authenticated users can insert NRW comments
CREATE POLICY "Authenticated users can insert nrw comments"
  ON nrw_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update NRW comments
CREATE POLICY "Authenticated users can update nrw comments"
  ON nrw_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tariffs_type ON tariffs(tariff_type, sort_order);
CREATE INDEX IF NOT EXISTS idx_nrw_comments_station_period ON nrw_comments(station_id, year, month);
