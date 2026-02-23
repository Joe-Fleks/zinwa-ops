/*
  # Create Monthly Reports Table

  ## Purpose
  Stores generated monthly operational reports for each Service Centre.
  Reports are generated automatically when all production logs for the month
  are available. They persist as downloadable alerts until downloaded.

  ## Trigger Logic
  - Generated on the 1st of the following month (or later) once the prior
    month's production logs reach full coverage.
  - Uses sales returns volume if Sage sales data is not yet available.

  ## New Tables
  - `monthly_reports`
    - `id` (uuid, pk)
    - `service_centre_id` (uuid, FK → service_centres)
    - `month` (int, 1–12)
    - `year` (int)
    - `report_data` (jsonb) – All compiled metric data for document generation
    - `status` (text) – 'ready' | 'downloaded'
    - `generated_at` (timestamptz)
    - `downloaded_at` (timestamptz, nullable)
    - `downloaded_by` (uuid, nullable)

  ## Security
  - RLS enabled with scope-aware select and insert/update policies

  ## Notes
  - Unique constraint on (service_centre_id, month, year) to prevent duplicates.
  - report_data jsonb contains all metrics for client-side Word doc generation.
*/

CREATE TABLE IF NOT EXISTS monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid REFERENCES service_centres(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'downloaded')),
  generated_at timestamptz DEFAULT now(),
  downloaded_at timestamptz,
  downloaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (service_centre_id, month, year)
);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view monthly reports for their scope"
  ON monthly_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM service_centres sc
            WHERE sc.id = monthly_reports.service_centre_id
              AND sc.catchment_id = ur.scope_id
          ))
          OR (ur.scope_type = 'SC' AND ur.scope_id = monthly_reports.service_centre_id)
        )
    )
  );

CREATE POLICY "Authenticated users can insert monthly reports"
  ON monthly_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND ur.scope_id = monthly_reports.service_centre_id)
        )
    )
  );

CREATE POLICY "Authenticated users can update monthly reports for their SC"
  ON monthly_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND ur.scope_id = monthly_reports.service_centre_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND ur.scope_id = monthly_reports.service_centre_id)
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_monthly_reports_sc_status
  ON monthly_reports(service_centre_id, status);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_year_month
  ON monthly_reports(year, month);
