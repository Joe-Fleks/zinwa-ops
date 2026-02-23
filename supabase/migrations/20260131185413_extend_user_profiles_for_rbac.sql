/*
  # Extend User Profiles for RBAC System

  1. Changes to user_profiles
    - Add `is_active` (boolean, default true) - User account status
    - Add `must_change_password` (boolean, default false) - Force password change on next login
    - Add `created_by` (uuid, nullable FK) - Admin who created this user
    - Add `last_login_at` (timestamptz, nullable) - Track last login

  2. Important Notes
    - is_active = false allows deactivation without data deletion
    - must_change_password triggers password reset flow on login
    - created_by tracks admin audit trail
*/

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by ON user_profiles(created_by);
