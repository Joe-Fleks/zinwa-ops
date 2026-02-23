/*
  # Create User Roles and Audit Logs Tables

  1. New Tables
    - `user_roles` - User to role assignments
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `role_id` (uuid, FK to roles)
      - `effective_from` (timestamptz) - When role assignment begins
      - `effective_to` (timestamptz, nullable) - When role assignment ends
      - `assigned_by` (uuid, FK to auth.users) - Who assigned this role
      - `created_at` (timestamptz)

    - `audit_logs` - Immutable audit trail
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) - User who performed action
      - `action_type` (text) - Action name (CREATE_USER, ASSIGN_ROLE, etc.)
      - `entity_type` (text) - Entity type (User, Role, UserScope, etc.)
      - `entity_id` (text) - ID of affected entity
      - `previous_value` (jsonb, nullable) - Previous state
      - `new_value` (jsonb, nullable) - New state
      - `ip_address` (text, nullable) - Request IP
      - `created_at` (timestamptz)

  2. Security
    - RLS enforces audit log immutability (no delete/update)
    - Only Admin can read full audit logs
    - Users can see logs for their own activities
*/

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  effective_from timestamptz DEFAULT now(),
  effective_to timestamptz,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Authenticated users can read their own roles"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR assigned_by = auth.uid());

CREATE POLICY "Users can read all active role assignments (for admin)"
  ON user_roles FOR SELECT TO authenticated
  USING (effective_to IS NULL);

-- Audit logs policies
CREATE POLICY "Users can read their own audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin' AND ur.effective_to IS NULL
    )
  );

-- Audit logs are append-only (no updates or deletes)
CREATE POLICY "No one can update audit logs"
  ON audit_logs FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No one can delete audit logs"
  ON audit_logs FOR DELETE TO authenticated
  USING (false);

-- Create indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_effective ON user_roles(user_id, effective_to);
CREATE UNIQUE INDEX idx_user_roles_active ON user_roles(user_id, role_id) WHERE effective_to IS NULL;
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
