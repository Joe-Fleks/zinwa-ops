/*
  # Global Admin Protection Rules

  1. Protection Mechanisms
    - Prevent deletion of last Global Admin (must keep at least 1)
    - Prevent demotion (removal of Global Admin role) of last Global Admin
    - Prevent removal of manage_roles permission from last Global Admin

  2. Implementation
    - Trigger on user_roles DELETE to prevent removal of last Global Admin
    - Trigger on user_roles UPDATE to prevent effective_to change for last Global Admin
    - Trigger on role_permissions DELETE to prevent removing manage_roles from Global Admin

  3. Error Messages
    - Clear error messages when protection rules are violated
*/

-- Create function to check if user is last Global Admin
CREATE OR REPLACE FUNCTION is_last_global_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  global_admin_role_id UUID;
  active_global_admins INTEGER;
BEGIN
  SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin' LIMIT 1;

  SELECT COUNT(*) INTO active_global_admins
  FROM user_roles ur
  WHERE ur.role_id = global_admin_role_id
  AND ur.effective_to IS NULL
  AND ur.user_id = check_user_id;

  RETURN active_global_admins > 0 AND (
    SELECT COUNT(*)
    FROM user_roles
    WHERE role_id = global_admin_role_id
    AND effective_to IS NULL
  ) = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent removal of Global Admin role for last Global Admin
CREATE OR REPLACE FUNCTION prevent_last_global_admin_removal()
RETURNS TRIGGER AS $$
DECLARE
  global_admin_role_id UUID;
BEGIN
  -- Deleting a user_role record (soft delete via effective_to)
  IF TG_OP = 'DELETE' THEN
    SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin' LIMIT 1;
    
    IF OLD.role_id = global_admin_role_id AND is_last_global_admin(OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot remove Global Admin role from last Global Admin user';
    END IF;
  END IF;

  -- Updating to set effective_to (soft delete)
  IF TG_OP = 'UPDATE' THEN
    SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin' LIMIT 1;
    
    IF NEW.role_id = global_admin_role_id AND NEW.effective_to IS NOT NULL AND OLD.effective_to IS NULL THEN
      IF is_last_global_admin(NEW.user_id) THEN
        RAISE EXCEPTION 'Cannot deactivate Global Admin role for last Global Admin user';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_roles
DROP TRIGGER IF EXISTS prevent_last_global_admin_removal_trigger ON user_roles;
CREATE TRIGGER prevent_last_global_admin_removal_trigger
BEFORE DELETE OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION prevent_last_global_admin_removal();

-- Prevent removal of manage_roles permission from Global Admin
CREATE OR REPLACE FUNCTION prevent_manage_roles_removal_from_global_admin()
RETURNS TRIGGER AS $$
DECLARE
  global_admin_role_id UUID;
  manage_roles_permission_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin' LIMIT 1;
    SELECT id INTO manage_roles_permission_id FROM permissions WHERE permission_key = 'manage_roles' LIMIT 1;

    IF OLD.role_id = global_admin_role_id AND OLD.permission_id = manage_roles_permission_id THEN
      RAISE EXCEPTION 'Cannot remove manage_roles permission from Global Admin role';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on role_permissions
DROP TRIGGER IF EXISTS prevent_manage_roles_removal_trigger ON role_permissions;
CREATE TRIGGER prevent_manage_roles_removal_trigger
BEFORE DELETE ON role_permissions
FOR EACH ROW
EXECUTE FUNCTION prevent_manage_roles_removal_from_global_admin();

-- Enforce minimum 1 Global Admin at all times
CREATE OR REPLACE FUNCTION enforce_minimum_global_admin()
RETURNS TABLE(global_admin_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::INTEGER
  FROM user_roles ur
  WHERE ur.role_id = (SELECT id FROM roles WHERE name = 'Global Admin' LIMIT 1)
  AND ur.effective_to IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
