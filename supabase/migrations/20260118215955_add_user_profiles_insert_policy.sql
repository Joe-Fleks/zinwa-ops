/*
  # Add Insert Policy for User Profiles

  1. Changes
    - Add INSERT policy to allow authenticated users to create their own profile during signup
  
  2. Security
    - Users can only insert their own profile (where auth.uid() = id)
    - This enables the signup process to work correctly
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
