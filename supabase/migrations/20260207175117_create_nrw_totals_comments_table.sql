/*
  # Create NRW Totals Comments Table

  1. New Tables
    - `nrw_totals_comments`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, nullable - NULL for global/unscoped)
      - `year` (integer)
      - `month` (integer)
      - `station_loss_comment` (text, default '')
      - `distribution_loss_comment` (text, default '')
      - `updated_by` (uuid, nullable)
      - `created_at`, `updated_at` (timestamptz)
      - Unique on (service_centre_id, year, month)

  2. Purpose
    - Stores comments for the combined NRW totals row (FT + BH aggregated)
    - Separate from station-level nrw_comments since totals are not station-specific

  3. Security
    - RLS enabled
    - All authenticated users can read, insert, update
*/

CREATE TABLE IF NOT EXISTS nrw_totals_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  station_loss_comment text NOT NULL DEFAULT '',
  distribution_loss_comment text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_centre_id, year, month)
);

ALTER TABLE nrw_totals_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nrw totals comments"
  ON nrw_totals_comments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert nrw totals comments"
  ON nrw_totals_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update nrw totals comments"
  ON nrw_totals_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_nrw_totals_comments_sc_period
  ON nrw_totals_comments(service_centre_id, year, month);
