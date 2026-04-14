/*
  # Create quarterly_reports table

  1. New Tables
    - `quarterly_reports`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, references service_centres)
      - `quarter` (integer, 1-4)
      - `year` (integer)
      - `report_data` (jsonb, stores full report JSON)
      - `status` (text, 'ready' or 'downloaded')
      - `generated_at` (timestamptz)
      - `downloaded_at` (timestamptz, nullable)
      - `downloaded_by` (uuid, nullable)
      - `created_at` (timestamptz)
      - Unique constraint on (service_centre_id, quarter, year)

  2. Security
    - Enable RLS on `quarterly_reports` table
    - Add select/insert/update policies for authenticated users
      who have a matching scope in user_roles
*/

CREATE TABLE IF NOT EXISTS quarterly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year integer NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready',
  generated_at timestamptz DEFAULT now(),
  downloaded_at timestamptz,
  downloaded_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (service_centre_id, quarter, year)
);

ALTER TABLE quarterly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quarterly reports for their service centre"
  ON quarterly_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.scope_id = quarterly_reports.service_centre_id
    )
  );

CREATE POLICY "Users can insert quarterly reports for their service centre"
  ON quarterly_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.scope_id = quarterly_reports.service_centre_id
    )
  );

CREATE POLICY "Users can update quarterly reports for their service centre"
  ON quarterly_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.scope_id = quarterly_reports.service_centre_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.scope_id = quarterly_reports.service_centre_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_quarterly_reports_sc_quarter_year
  ON quarterly_reports(service_centre_id, quarter, year);
