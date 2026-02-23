/*
  # Add Anonymous SELECT Policy to user_profiles

  Allow anonymous users to check if an email exists during pre-registration.
  
  1. New Policy
    - `Anon can check profiles` - Allows anon role to SELECT from user_profiles
  
  2. Security
    - RLS remains enabled
    - Existing authenticated policies unchanged
    - Anonymous access is read-only with no restrictions (true condition)
    - Login pre-check can now execute as anon role
*/

CREATE POLICY "Anon can check profiles"
  ON public.user_profiles
  FOR SELECT
  TO anon
  USING (true);
