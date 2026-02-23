/*
  # Normalize Scope Type Enum Values

  1. Changes
    - Update user_scope table CHECK constraint to use uppercase values
    - Ensure consistency across all scope_type columns
    - Update any existing data to use uppercase

  2. Values
    - Old: 'SC', 'Catchment', 'National'
    - New: 'SC', 'CATCHMENT', 'NATIONAL'

  3. Notes
    - user_roles table already has correct uppercase constraint
    - This ensures consistency between tables
*/

ALTER TABLE user_scope DROP CONSTRAINT IF EXISTS user_scope_scope_type_check;

UPDATE user_scope SET scope_type = 'CATCHMENT' WHERE scope_type = 'Catchment';
UPDATE user_scope SET scope_type = 'NATIONAL' WHERE scope_type = 'National';

ALTER TABLE user_scope
ADD CONSTRAINT user_scope_scope_type_check
CHECK (scope_type IN ('SC', 'CATCHMENT', 'NATIONAL'));
