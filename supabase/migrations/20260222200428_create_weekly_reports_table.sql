/*
  # Create Weekly Reports Table

  ## Purpose
  Stores generated weekly operational reports for each Service Centre.
  Reports are generated automatically when production data for the report period
  is fully updated. Reports persist as downloadable alerts until downloaded.

  ## Report Types
  - Friday report: Covers Fri–Thu (standard weekly period). Generated on Friday
    once Thursday's production logs are updated.
  - Tuesday report: Covers Tue–Mon. Generated on Tuesday once Monday's logs are
    updated.

  ## New Tables
  - `weekly_reports`
    - `id` (uuid, pk)
    - `service_centre_id` (uuid, FK → service_centres)
    - `week_number` (int) – Friday-based week number within the year
    - `year` (int)
    - `report_type` (text) – 'friday' | 'tuesday'
    - `period_start` (date) – First day of the report period
    - `period_end` (date) – Last day of the report period
    - `report_data` (jsonb) – All compiled metric data for document generation
    - `status` (text) – 'ready' | 'downloaded'
    - `generated_at` (timestamptz)
    - `downloaded_at` (timestamptz, nullable)
    - `downloaded_by` (uuid, nullable)

  ## Security
  - RLS enabled
  - Authenticated users with SC scope can read reports for their SC
  - Only server-side inserts (service role) or admins with system_rank >= 70

  ## Notes
  - Unique constraint on (service_centre_id, week_number, year, report_type)
    to prevent duplicate reports for the same period.
  - The `report_data` jsonb stores all metrics needed to render the Word document
    client-side without re-querying.
*/

CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid REFERENCES service_centres(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  year integer NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('friday', 'tuesday')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'downloaded')),
  generated_at timestamptz DEFAULT now(),
  downloaded_at timestamptz,
  downloaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (service_centre_id, week_number, year, report_type)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports for their scope"
  ON weekly_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM service_centres sc
            WHERE sc.id = weekly_reports.service_centre_id
              AND sc.catchment_id = ur.scope_id
          ))
          OR (ur.scope_type = 'SC' AND ur.scope_id = weekly_reports.service_centre_id)
        )
    )
  );

CREATE POLICY "Authenticated users can insert reports"
  ON weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND ur.scope_id = weekly_reports.service_centre_id)
        )
    )
  );

CREATE POLICY "Authenticated users can update their SC reports"
  ON weekly_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND ur.scope_id = weekly_reports.service_centre_id)
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
          OR (ur.scope_type = 'SC' AND ur.scope_id = weekly_reports.service_centre_id)
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_weekly_reports_sc_status
  ON weekly_reports(service_centre_id, status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_year_week
  ON weekly_reports(year, week_number);
