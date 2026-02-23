/*
  # Create User Invitations Table

  1. New Tables
    - `user_invitations`
      - `id` (uuid, primary key) - Unique identifier
      - `inviter_id` (uuid, references auth.users) - User sending the invitation
      - `email` (text) - Email address being invited
      - `status` (text) - 'pending', 'accepted', or 'declined'
      - `created_at` (timestamptz) - When invitation was sent
      - `expires_at` (timestamptz) - When invitation expires (30 days from creation)
      - `accepted_at` (timestamptz) - When invitation was accepted (null if pending/declined)

  2. Security
    - Enable RLS on invitations table
    - Users can view their own sent invitations and invitations addressed to them
    - Only inviters can update/delete their own invitations
    - New users created from accepted invitations are handled separately

  3. Important Notes
    - Invitations expire after 30 days
    - Email field allows multiple invitations to same email (for retry/updates)
    - This provides flexible access sharing without requiring pre-signup
*/

CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz
);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sent invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

CREATE POLICY "Users can view invitations sent to them"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert invitations"
  ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Users can update their invitations"
  ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Users can delete their invitations"
  ON user_invitations
  FOR DELETE
  TO authenticated
  USING (inviter_id = auth.uid());

CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_inviter_id ON user_invitations(inviter_id);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
CREATE UNIQUE INDEX idx_user_invitations_pending_email ON user_invitations(email) WHERE status = 'pending';
