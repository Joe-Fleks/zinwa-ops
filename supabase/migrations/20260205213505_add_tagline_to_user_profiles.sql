/*
  # Add tagline field to user profiles

  1. Modified Tables
    - `user_profiles`
      - `tagline` (text, nullable) - Short personal tagline/bio displayed on profile card

  2. Security
    - No policy changes needed; existing "Users can update own profile" UPDATE policy
      already allows users to update their own row

  3. Notes
    - Optional field, user-managed via profile update modal
    - Maximum display length enforced at the UI level (approx 2 lines)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'tagline'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tagline text;
  END IF;
END $$;
