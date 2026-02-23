/*
  # Add Foreign Key Constraint: user_roles.user_id -> user_profiles.id

  1. Changes
    - Add foreign key constraint from user_roles.user_id to user_profiles.id
    - Constraint name: fk_user_roles_user_id_user_profiles
    - ON DELETE CASCADE: Automatically delete user_roles when user_profiles is deleted
    - ON UPDATE CASCADE: Automatically update user_roles when user_profiles.id is updated
  
  2. Data Impact
    - No data is modified or deleted
    - All existing user_roles.user_id values reference valid user_profiles.id entries
    - Constraint enforces referential integrity going forward

  3. Security Impact
    - RLS policies remain unchanged
    - PostgREST relationship discovery is now enabled
    - API clients can use nested select syntax: select("*, user_roles(*)")
*/

ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_user_id_user_profiles
FOREIGN KEY (user_id)
REFERENCES user_profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;
