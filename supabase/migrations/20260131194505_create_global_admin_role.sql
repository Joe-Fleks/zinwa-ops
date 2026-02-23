/*
  # Create Global Admin Role

  1. New Global Admin Role
    - Create "Global Admin" role as distinct from "Admin"
    - Global Admin has ALL system permissions
    - Global Admin scope is always National (never SC or Catchment)

  2. Permission Assignment
    - Assign all existing permissions to Global Admin role
    - Includes: manage_users, manage_roles, manage_maintenance, edit_* permissions, view_* permissions

  3. Naming Convention
    - "Global Admin" is the new system administrator role
    - "Admin" role remains for backward compatibility but should be deprecated

  4. Important Notes
    - Global Admin users can only have National scope (enforced via policies)
    - This role is foundational for bootstrap logic
    - Minimum 1 Global Admin required at all times (enforced later)
*/

DO $$
DECLARE
  global_admin_role_id UUID;
BEGIN
  -- Create Global Admin role if it doesn't exist
  INSERT INTO roles (name, description, created_at)
  VALUES ('Global Admin', 'System administrator with all permissions. Scope must always be National.', NOW())
  ON CONFLICT (name) DO NOTHING;

  -- Get the Global Admin role ID
  SELECT id INTO global_admin_role_id FROM roles WHERE name = 'Global Admin';

  -- Assign all permissions to Global Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT global_admin_role_id, id
  FROM permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;
