/*
  # Create user presence tracking table

  1. New Tables
    - `user_presence`
      - `user_id` (uuid, primary key, references auth.users)
      - `last_active_at` (timestamptz, when user was last active)
      - `is_idle` (boolean, whether user is idle - no mouse/keyboard for 10+ min)
      - `updated_at` (timestamptz, auto-updated)

  2. Security
    - Enable RLS on `user_presence` table
    - Authenticated users can read all presence data
    - Users can only insert/update their own presence record

  3. Notes
    - Uses upsert pattern for heartbeat updates
    - Online = last_active_at within 2 minutes and not idle
    - Idle = last_active_at within 10 minutes but marked idle
    - Offline = last_active_at older than 2 minutes
*/

CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  is_idle boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all presence"
  ON user_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
