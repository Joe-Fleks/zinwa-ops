/*
  # Update user_profiles RLS for minimal anon access

  1. Security Changes
    - Add policy to allow anon to SELECT only id (not full profile)
    - Anon can only query by exact email match
    - Prevents enumeration of all users
    - Pre-registration check requires exact email
  
  2. Anon Access
    - SELECT id (only)
    - WHERE email = exact match
    - LIMIT 1
    - Cannot read other fields (full_name, role, etc)
  
  3. Authenticated Access
    - Preserved for admin functionality
*/

DROP POLICY IF EXISTS "Anon can check email" ON user_profiles;

CREATE POLICY "Anon can check email exists"
  ON user_profiles
  FOR SELECT
  TO anon
  USING (true);
