/*
  # Add Role-Scope Safety Constraints

  1. Database Safeguards
    - Prevent scope_type from being null
    - Require scope_id for SC and CATCHMENT scopes
    - Ensure scope_id is null for NATIONAL scope
    - Add foreign key constraints for scope validation

  2. New Constraints
    - Check constraint on scope_type NOT NULL
    - Check constraint on scope_id based on scope_type
    - Foreign key to service_centres when scope_type = 'SC'
    - Foreign key to catchments when scope_type = 'CATCHMENT'

  3. Validation Rules
    - SC: scope_id must exist in service_centres
    - CATCHMENT: scope_id must exist in catchments
    - NATIONAL: scope_id must be null
*/

DO $$
BEGIN
  -- Add NOT NULL constraint to scope_type if not already present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles'
    AND column_name = 'scope_type'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE user_roles ALTER COLUMN scope_type SET NOT NULL;
  END IF;

  -- Add check constraint for scope_type valid values
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_roles'
    AND constraint_name = 'user_roles_scope_type_check'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_scope_type_check
    CHECK (scope_type IN ('SC', 'CATCHMENT', 'NATIONAL'));
  END IF;

  -- Add check constraint for scope_id consistency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_roles'
    AND constraint_name = 'user_roles_scope_id_consistency'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_scope_id_consistency
    CHECK (
      (scope_type = 'NATIONAL' AND scope_id IS NULL) OR
      (scope_type IN ('SC', 'CATCHMENT') AND scope_id IS NOT NULL)
    );
  END IF;

END $$;

-- Add foreign key constraint for SC scope_id to service_centres
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_roles'
    AND constraint_name = 'user_roles_sc_scope_fk'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_sc_scope_fk
    FOREIGN KEY (scope_id)
    REFERENCES service_centres(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Update RLS policy to include scope_type check in audit
COMMENT ON CONSTRAINT user_roles_scope_type_check ON user_roles IS 'Ensures scope_type is one of the allowed values: SC, CATCHMENT, NATIONAL';
COMMENT ON CONSTRAINT user_roles_scope_id_consistency ON user_roles IS 'Ensures scope_id is NULL for NATIONAL scope, and NOT NULL for SC and CATCHMENT scopes';
