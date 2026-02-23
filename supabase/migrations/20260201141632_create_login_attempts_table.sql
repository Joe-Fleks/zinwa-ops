/*
  # Create login_attempts table for security hardening

  1. New Tables
    - `login_attempts`
      - `id` (uuid, primary key)
      - `email` (text, indexed)
      - `failed_attempts` (integer, default 0)
      - `locked_until` (timestamptz, nullable)
      - `last_attempt_at` (timestamptz)
  
  2. Security
    - Enable RLS on `login_attempts`
    - Add policy to prevent direct user access (system-only)
    - Allow service role to manage login attempts
  
  3. Notes
    - Email-based locking across all attempts
    - 15-minute lockout after 3 failures
    - Indexed by email for performance
*/

CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  failed_attempts integer DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System only - prevent direct access"
  ON login_attempts
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "System only - prevent insert"
  ON login_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "System only - prevent update"
  ON login_attempts
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "System only - prevent delete"
  ON login_attempts
  FOR DELETE
  TO authenticated
  USING (false);
