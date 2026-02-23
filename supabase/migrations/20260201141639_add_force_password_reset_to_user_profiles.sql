/*
  # Add force_password_reset to user_profiles

  1. Modified Tables
    - `user_profiles`
      - Add `force_password_reset` (boolean, default TRUE)
      - New users must change password on first login
  
  2. Behavior
    - All new users start with force_password_reset = TRUE
    - Admins can reset to TRUE for users
    - Set to FALSE after successful password change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'force_password_reset'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN force_password_reset boolean DEFAULT true;
  END IF;
END $$;
