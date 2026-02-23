/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses database security and performance issues identified by Supabase analysis.

  ## Changes Made

  ### 1. Add Missing Indexes on Foreign Keys
  Adds indexes to improve query performance for foreign key relationships:
  - `idx_alerts_created_by` on alerts.created_by
  - `idx_equipment_station` on equipment_register.station_id
  - `idx_maintenance_technician` on maintenance_records.technician_id
  - `idx_abstraction_dam` on raw_water_abstraction.dam_id
  - `idx_abstraction_user` on raw_water_abstraction.user_id

  ### 2. Optimize RLS Policies
  Improves Row Level Security performance by wrapping auth.uid() calls with SELECT.
  This prevents re-evaluation of auth functions for each row, significantly improving query performance at scale.
  
  Policies optimized:
  - user_profiles: update and insert policies
  - clear_water_stations: management policy
  - station_daily_production: management policy
  - raw_water_dams: management policy
  - raw_water_users: management policy
  - raw_water_abstraction: management policy
  - equipment_register: management policy
  - maintenance_records: management policy
  - alerts: management policy

  ### 3. Remove Unused Indexes
  Removes indexes that are not being used by query plans:
  - `idx_station_production_date` (redundant with composite unique index)
  - `idx_station_production_station` (covered by composite unique index)
  - `idx_abstraction_date` (not used in query plans)
  - `idx_maintenance_equipment` (not used in query plans)

  ## Security Notes
  - All RLS policies remain restrictive and secure
  - No changes to access control logic, only performance optimizations
  - Auth function initialization prevents per-row re-evaluation
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Index for alerts.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_alerts_created_by 
  ON alerts(created_by);

-- Index for equipment_register.station_id foreign key
CREATE INDEX IF NOT EXISTS idx_equipment_station 
  ON equipment_register(station_id);

-- Index for maintenance_records.technician_id foreign key
CREATE INDEX IF NOT EXISTS idx_maintenance_technician 
  ON maintenance_records(technician_id);

-- Index for raw_water_abstraction.dam_id foreign key
CREATE INDEX IF NOT EXISTS idx_abstraction_dam 
  ON raw_water_abstraction(dam_id);

-- Index for raw_water_abstraction.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_abstraction_user 
  ON raw_water_abstraction(user_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES
-- ============================================================================

-- Drop and recreate policies with optimized auth.uid() calls

-- user_profiles policies
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- clear_water_stations policies
DROP POLICY IF EXISTS "Operations managers and engineers can manage stations" ON clear_water_stations;
CREATE POLICY "Operations managers and engineers can manage stations"
  ON clear_water_stations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  );

-- station_daily_production policies
DROP POLICY IF EXISTS "Operations staff can manage production data" ON station_daily_production;
CREATE POLICY "Operations staff can manage production data"
  ON station_daily_production FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor')
    )
  );

-- raw_water_dams policies
DROP POLICY IF EXISTS "Operations managers and engineers can manage dams" ON raw_water_dams;
CREATE POLICY "Operations managers and engineers can manage dams"
  ON raw_water_dams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  );

-- raw_water_users policies
DROP POLICY IF EXISTS "Operations managers and engineers can manage raw water users" ON raw_water_users;
CREATE POLICY "Operations managers and engineers can manage raw water users"
  ON raw_water_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer')
    )
  );

-- raw_water_abstraction policies
DROP POLICY IF EXISTS "Operations staff can manage abstraction data" ON raw_water_abstraction;
CREATE POLICY "Operations staff can manage abstraction data"
  ON raw_water_abstraction FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor')
    )
  );

-- equipment_register policies
DROP POLICY IF EXISTS "Operations staff can manage equipment" ON equipment_register;
CREATE POLICY "Operations staff can manage equipment"
  ON equipment_register FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor', 'technician')
    )
  );

-- maintenance_records policies
DROP POLICY IF EXISTS "Operations staff can manage maintenance records" ON maintenance_records;
CREATE POLICY "Operations staff can manage maintenance records"
  ON maintenance_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role IN ('operations_manager', 'engineer', 'supervisor', 'technician')
    )
  );

-- alerts policies
DROP POLICY IF EXISTS "Operations managers can manage alerts" ON alerts;
CREATE POLICY "Operations managers can manage alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'operations_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
        AND user_profiles.role = 'operations_manager'
    )
  );

-- ============================================================================
-- 3. REMOVE UNUSED INDEXES
-- ============================================================================

-- Remove redundant and unused indexes
DROP INDEX IF EXISTS idx_station_production_date;
DROP INDEX IF EXISTS idx_station_production_station;
DROP INDEX IF EXISTS idx_abstraction_date;
DROP INDEX IF EXISTS idx_maintenance_equipment;
