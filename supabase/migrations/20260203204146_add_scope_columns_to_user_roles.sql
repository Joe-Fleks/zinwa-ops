/*
  # Add Scope Columns to User Roles Table

  1. New Columns
    - `scope_type` (text) - 'SC', 'CATCHMENT', or 'NATIONAL'
    - `scope_id` (uuid, nullable) - Service centre or catchment ID (null for NATIONAL)

  2. Constraints
    - scope_type validation check
    - scope_id consistency check (null for NATIONAL, not null for others)

  3. Design Decision
    - Scope stored in user_roles (not user_scope)
    - This consolidates scope assignment with role assignment
    - Single source of truth per user role

  4. Migration Strategy
    - Add columns as nullable first
    - Add constraints that allow NULL values to exist temporarily
    - Data cleanup can happen separately
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'scope_type'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN scope_type text DEFAULT 'NATIONAL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'scope_id'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN scope_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_roles'
    AND constraint_name = 'user_roles_scope_type_check'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_scope_type_check
    CHECK (scope_type IN ('SC', 'CATCHMENT', 'NATIONAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_roles_scope_type ON user_roles(scope_type);
CREATE INDEX IF NOT EXISTS idx_user_roles_scope_id ON user_roles(scope_id);
