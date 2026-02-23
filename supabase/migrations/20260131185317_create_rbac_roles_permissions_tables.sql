/*
  # Create RBAC System: Roles and Permissions Tables

  1. New Tables
    - `roles` - System and custom roles
      - `id` (uuid, primary key)
      - `name` (text, unique) - Role identifier
      - `description` (text) - Human-readable description
      - `is_system_role` (boolean) - System roles cannot be deleted
      - `created_at` (timestamptz)

    - `permissions` - Granular permissions
      - `id` (uuid, primary key)
      - `permission_key` (text, unique) - Machine-readable key
      - `description` (text) - Human-readable description
      - `created_at` (timestamptz)

    - `role_permissions` - Many-to-many mapping
      - `role_id` (uuid, FK)
      - `permission_id` (uuid, FK)
      - PRIMARY KEY (role_id, permission_id)

  2. Pre-seeded Roles
    - TO, MO, RO, STL (Technician roles)
    - CM (Catchment Manager)
    - WSSE, WSSM (Senior managers)
    - Maintenance Manager
    - Director, CEO
    - Admin (full access)

  3. Pre-seeded Permissions
    - Dashboard access (SC, Catchment, National, Advanced metrics)
    - Data management (production, sales, targets)
    - Operations (maintenance)
    - Administration (users, roles, scope assignment, password reset)
*/

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_system_role boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Roles are readable by authenticated users
CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT TO authenticated USING (true);

-- Permissions are readable by authenticated users
CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT TO authenticated USING (true);

-- Role permissions are readable by authenticated users
CREATE POLICY "Authenticated users can read role permissions"
  ON role_permissions FOR SELECT TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_permissions_key ON permissions(permission_key);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Insert system roles
INSERT INTO roles (name, description, is_system_role) VALUES
  ('TO', 'Technical Officer', true),
  ('MO', 'Maintenance Officer', true),
  ('RO', 'Records Officer', true),
  ('STL', 'Shift Team Leader', true),
  ('CM', 'Catchment Manager', true),
  ('WSSE', 'Water Services Senior Engineer', true),
  ('WSSM', 'Water Services Senior Manager', true),
  ('Maintenance Manager', 'Maintenance Manager', true),
  ('Director', 'Director', true),
  ('CEO', 'Chief Executive Officer', true),
  ('Admin', 'System Administrator', true)
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (permission_key, description) VALUES
  ('view_sc_dashboard', 'View Service Centre dashboard'),
  ('view_catchment_dashboard', 'View Catchment dashboard'),
  ('view_national_dashboard', 'View National dashboard'),
  ('view_advanced_metrics', 'View advanced metrics and analytics'),
  ('edit_production_data', 'Edit production data'),
  ('edit_sales_data', 'Edit sales data'),
  ('edit_targets', 'Edit performance targets'),
  ('manage_maintenance', 'Manage maintenance operations'),
  ('manage_users', 'Manage users and invitations'),
  ('manage_roles', 'Create and modify roles'),
  ('assign_scope', 'Assign user scope (SC, Catchment, National)'),
  ('reset_password', 'Reset user passwords')
ON CONFLICT (permission_key) DO NOTHING;
