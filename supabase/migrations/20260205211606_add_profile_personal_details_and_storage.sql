/*
  # Add personal profile details and avatar storage

  1. Modified Tables
    - `user_profiles`
      - `profile_picture_url` (text, nullable) - URL to user's profile picture in storage
      - `contact_number_1` (text, nullable) - Primary contact number
      - `contact_number_2` (text, nullable) - Secondary contact number

  2. Storage
    - Create `profile-pictures` bucket (public read access for serving images)
    - Storage policies for authenticated users to manage their own avatars

  3. Security
    - Existing UPDATE policy ("Users can update own profile") already allows
      authenticated users to update only their own row via auth.uid() = id
    - Storage policies restrict uploads/deletes to user's own folder only
    - No changes to existing RBAC system or RLS policies

  4. Notes
    - These fields are optional and user-managed (not set during admin user creation)
    - Profile picture stored at path: {user_id}/avatar.{ext}
*/

-- Add personal detail columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_picture_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'contact_number_1'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN contact_number_1 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'contact_number_2'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN contact_number_2 text;
  END IF;
END $$;

-- Create storage bucket for profile pictures (public read for serving)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: authenticated users can update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: authenticated users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: anyone can read profile pictures (public bucket)
CREATE POLICY "Anyone can read profile pictures"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-pictures');
