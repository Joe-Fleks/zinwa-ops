/*
  # Create Custom Follow-up Alerts Table

  ## Purpose
  Stores user-created custom follow-up alert items on the Operations Dashboard.

  ## New Tables
  - `custom_followup_alerts`
    - `id` (uuid, primary key)
    - `service_centre_id` (uuid, FK to service_centres) — scope the alert to a specific SC
    - `subtitle` (text) — bold small-letter subtitle shown on the alert card
    - `body` (text) — normal text body of the alert
    - `created_by` (uuid, FK to auth.users)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read alerts for their scoped service centre
  - Authenticated users can insert/update/delete their own alerts
*/

CREATE TABLE IF NOT EXISTS custom_followup_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid REFERENCES service_centres(id) ON DELETE CASCADE,
  subtitle text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_followup_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom followup alerts"
  ON custom_followup_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert custom followup alerts"
  ON custom_followup_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update custom followup alerts"
  ON custom_followup_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete custom followup alerts"
  ON custom_followup_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
