/*
  # Add Dual Power Model: Authority Rank and System Rank

  1. Schema Extension
    - Add authority_rank column to roles (represents organizational authority)
    - Add system_rank column to roles (represents system administrative power)
    - Both columns independent and non-overlapping

  2. Authority Rank Mapping (organizational hierarchy)
    - CEO = 100 (highest organizational authority)
    - Director = 90
    - WSSM = 80
    - WSSE = 70
    - Catchment Manager = 60
    - STL = 50
    - TO = 40
    - RO = 40
    - MO = 40
    - Admin-only roles = 0

  3. System Rank Mapping (administrative system power)
    - Global Admin = 100 (full system control)
    - National Admin = 90 (if exists)
    - Catchment Admin = 80 (if exists)
    - SC Admin = 70 (if exists)
    - All other roles = 0

  4. Preservation
    - No existing columns removed
    - No existing RLS policies altered
    - Existing role assignments remain unchanged
    - Global Admin user functionality preserved
*/

DO $$
BEGIN
  -- Add authority_rank column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'authority_rank'
  ) THEN
    ALTER TABLE roles ADD COLUMN authority_rank INTEGER DEFAULT 0 NOT NULL;
  END IF;

  -- Add system_rank column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'system_rank'
  ) THEN
    ALTER TABLE roles ADD COLUMN system_rank INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Populate system_rank for admin roles
UPDATE roles SET system_rank = 100 WHERE name = 'Global Admin';
UPDATE roles SET system_rank = 90 WHERE name = 'National Admin';
UPDATE roles SET system_rank = 80 WHERE name = 'Catchment Admin';
UPDATE roles SET system_rank = 70 WHERE name = 'SC Admin';

-- Populate authority_rank for organizational roles
UPDATE roles SET authority_rank = 100 WHERE name = 'CEO';
UPDATE roles SET authority_rank = 90 WHERE name = 'Director';
UPDATE roles SET authority_rank = 80 WHERE name = 'WSSM';
UPDATE roles SET authority_rank = 70 WHERE name = 'WSSE';
UPDATE roles SET authority_rank = 60 WHERE name = 'CM';
UPDATE roles SET authority_rank = 50 WHERE name = 'STL';
UPDATE roles SET authority_rank = 40 WHERE name IN ('TO', 'RO', 'MO');
UPDATE roles SET authority_rank = 0 WHERE name IN ('Admin', 'Global Admin', 'National Admin', 'Catchment Admin', 'SC Admin', 'Maintenance Manager');

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_roles_system_rank ON roles(system_rank);
CREATE INDEX IF NOT EXISTS idx_roles_authority_rank ON roles(authority_rank);
