/*
  # Create Catchments, Service Centres, and User Scope Tables

  1. New Tables
    - `catchments` - Water catchment areas
      - `id` (uuid, primary key)
      - `name` (text, unique) - Catchment name
      - `created_at` (timestamptz)

    - `service_centres` - Service centres within catchments
      - `id` (uuid, primary key)
      - `name` (text, unique) - SC name
      - `catchment_id` (uuid, FK) - Parent catchment
      - `created_at` (timestamptz)

    - `user_scope` - Scope assignment for users
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) - User being scoped
      - `scope_type` (text) - 'SC', 'Catchment', or 'National'
      - `scope_id` (uuid, nullable FK) - SC or Catchment ID (null for National)
      - `created_at` (timestamptz)
      - UNIQUE (user_id, scope_type, scope_id)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read public scope info
*/

CREATE TABLE IF NOT EXISTS catchments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  catchment_id uuid NOT NULL REFERENCES catchments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('SC', 'Catchment', 'National')),
  scope_id uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, scope_type, scope_id)
);

ALTER TABLE catchments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scope ENABLE ROW LEVEL SECURITY;

-- Catchments readable by authenticated users
CREATE POLICY "Authenticated users can read catchments"
  ON catchments FOR SELECT TO authenticated USING (true);

-- Service centres readable by authenticated users
CREATE POLICY "Authenticated users can read service centres"
  ON service_centres FOR SELECT TO authenticated USING (true);

-- Users can read their own scope
CREATE POLICY "Users can read their own scope"
  ON user_scope FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX idx_catchments_name ON catchments(name);
CREATE INDEX idx_service_centres_catchment_id ON service_centres(catchment_id);
CREATE INDEX idx_user_scope_user_id ON user_scope(user_id);
CREATE INDEX idx_user_scope_scope_type ON user_scope(scope_type);
CREATE INDEX idx_user_scope_scope_id ON user_scope(scope_id);

-- Pre-seed Murombedzi catchment and service centre
INSERT INTO catchments (name) VALUES
  ('Murombedzi')
ON CONFLICT (name) DO NOTHING;

INSERT INTO service_centres (name, catchment_id) 
SELECT 'Murombedzi SC', id FROM catchments WHERE name = 'Murombedzi'
ON CONFLICT (name) DO NOTHING;
