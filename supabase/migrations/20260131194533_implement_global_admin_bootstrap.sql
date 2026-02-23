/*
  # Bootstrap Global Admin Role

  1. Bootstrap Logic
    - Automatically assigns Global Admin role to the earliest created user if no Global Admin exists
    - Assigns National scope to the Global Admin user
    - Logs audit event with action_type: BOOTSTRAP_GLOBAL_ADMIN

  2. Execution
    - Only runs if no users have Global Admin role (count = 0)
    - Assigns to earliest created user from user_profiles
    - Creates audit log entry

  3. Prevention of Duplication
    - Checks count before assigning to prevent multiple assignments
*/

DO $$
DECLARE
  global_admin_role_id UUID;
  earliest_user_id UUID;
BEGIN
  -- Get Global Admin role ID
  SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin' LIMIT 1;

  -- Check if no Global Admin users exist
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.role_id = global_admin_role_id
    AND ur.effective_to IS NULL
  ) THEN
    -- Find the earliest created user
    SELECT id INTO earliest_user_id
    FROM user_profiles
    ORDER BY created_at ASC
    LIMIT 1;

    -- Assign Global Admin role to earliest user
    IF earliest_user_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id, assigned_by)
      VALUES (earliest_user_id, global_admin_role_id, NULL);

      -- Assign National scope
      INSERT INTO user_scope (user_id, scope_type, scope_id)
      VALUES (earliest_user_id, 'National', NULL);

      -- Log audit event
      INSERT INTO audit_logs (
        user_id,
        action_type,
        entity_type,
        entity_id,
        new_value
      ) VALUES (
        earliest_user_id,
        'BOOTSTRAP_GLOBAL_ADMIN',
        'user_roles',
        earliest_user_id::text,
        jsonb_build_object(
          'role', 'Global Admin',
          'scope', 'National',
          'timestamp', NOW()
        )
      );
    END IF;
  END IF;
END $$;
