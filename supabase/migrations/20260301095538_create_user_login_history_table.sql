/*
  # Create User Login History Table

  1. New Tables
    - `user_login_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, the user's email at time of login)
      - `logged_in_at` (timestamptz, when the login occurred)

  2. Security
    - Enable RLS on `user_login_history` table
    - Only authenticated users can insert their own login records
    - Only Global Admins (system_rank > 0) can read login history

  3. Indexes
    - Index on user_id for fast lookups
    - Index on logged_in_at for date range filtering

  4. Notes
    - This table records each successful login event going forward
    - Historical logins before this migration are not backfilled
    - Used by the Audit Logs engagement summary visible to Global Admins only
*/

CREATE TABLE IF NOT EXISTS user_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL DEFAULT '',
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON user_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_history_logged_in_at ON user_login_history(logged_in_at);

ALTER TABLE user_login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own login record"
  ON user_login_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Global admins can read all login history"
  ON user_login_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.effective_to IS NULL
        AND r.system_rank > 0
    )
  );
