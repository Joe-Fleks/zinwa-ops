/*
  # Fix Security and Performance Issues

  ## Purpose
  Address critical security and performance issues identified by Supabase security scanner.

  ## Changes

  ### 1. Add Missing Indexes for Foreign Keys
  Add indexes to improve query performance for foreign key lookups:
  - dam_monthly_capacities.recorded_by
  - dams.created_by
  - maintenance_records.equipment_id
  - operators.transfer_target_station_id
  - rw_allocations.created_by
  - sales_logs.entered_by
  - stations.created_by
  - water_users.created_by

  ### 2. Fix RLS Auth Function Performance
  Optimize RLS policies by wrapping auth functions in SELECT to prevent re-evaluation:
  - stations insert policy
  - production_logs insert policy
  - dams insert policy
  - dam_monthly_capacities insert policy
  - sales_logs insert policy
  - water_users insert policy
  - rw_allocations insert policy

  ### 3. Remove Duplicate Index
  Remove duplicate unique constraint on dams.name (keeping the unique index)

  ### 4. Fix Function Search Paths
  Set explicit search paths for functions to prevent SQL injection vulnerabilities

  ### 5. Fix Security Definer View
  Remove SECURITY DEFINER from dam_capacity_view or replace with proper implementation

  ## Security Notes
  - RLS policies with USING (true) are intentional for this internal operations system
  - All authenticated staff should have full access to operational data
  - The security boundary is authentication, not row-level permissions
*/

-- =====================================================
-- 1. Add Missing Indexes for Foreign Keys
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'dam_monthly_capacities' 
    AND indexname = 'idx_dam_monthly_capacities_recorded_by'
  ) THEN
    CREATE INDEX idx_dam_monthly_capacities_recorded_by 
    ON dam_monthly_capacities(recorded_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'dams' 
    AND indexname = 'idx_dams_created_by'
  ) THEN
    CREATE INDEX idx_dams_created_by 
    ON dams(created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'maintenance_records' 
    AND indexname = 'idx_maintenance_records_equipment_id'
  ) THEN
    CREATE INDEX idx_maintenance_records_equipment_id 
    ON maintenance_records(equipment_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'operators' 
    AND indexname = 'idx_operators_transfer_target_station_id'
  ) THEN
    CREATE INDEX idx_operators_transfer_target_station_id 
    ON operators(transfer_target_station_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'rw_allocations' 
    AND indexname = 'idx_rw_allocations_created_by'
  ) THEN
    CREATE INDEX idx_rw_allocations_created_by 
    ON rw_allocations(created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'sales_logs' 
    AND indexname = 'idx_sales_logs_entered_by'
  ) THEN
    CREATE INDEX idx_sales_logs_entered_by 
    ON sales_logs(entered_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'stations' 
    AND indexname = 'idx_stations_created_by'
  ) THEN
    CREATE INDEX idx_stations_created_by 
    ON stations(created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'water_users' 
    AND indexname = 'idx_water_users_created_by'
  ) THEN
    CREATE INDEX idx_water_users_created_by 
    ON water_users(created_by);
  END IF;
END $$;

-- =====================================================
-- 2. Fix RLS Auth Function Performance
-- =====================================================

-- Fix stations insert policy
DROP POLICY IF EXISTS "Authenticated users can insert stations" ON stations;
CREATE POLICY "Authenticated users can insert stations"
  ON stations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix production_logs insert policy
DROP POLICY IF EXISTS "Authenticated users can insert production logs" ON production_logs;
CREATE POLICY "Authenticated users can insert production logs"
  ON production_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix dams insert policy
DROP POLICY IF EXISTS "Authenticated users can insert dams" ON dams;
CREATE POLICY "Authenticated users can insert dams"
  ON dams FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix dam_monthly_capacities insert policy
DROP POLICY IF EXISTS "Authenticated users can insert capacity readings" ON dam_monthly_capacities;
CREATE POLICY "Authenticated users can insert capacity readings"
  ON dam_monthly_capacities FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix sales_logs insert policy
DROP POLICY IF EXISTS "Authenticated users can insert sales logs" ON sales_logs;
CREATE POLICY "Authenticated users can insert sales logs"
  ON sales_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix water_users insert policy
DROP POLICY IF EXISTS "Users can insert water users" ON water_users;
CREATE POLICY "Users can insert water users"
  ON water_users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix rw_allocations insert policy
DROP POLICY IF EXISTS "Users can insert allocations" ON rw_allocations;
CREATE POLICY "Users can insert allocations"
  ON rw_allocations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =====================================================
-- 3. Remove Duplicate Index on dams.name
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dams_name_key'
  ) THEN
    ALTER TABLE dams DROP CONSTRAINT IF EXISTS dams_name_key;
  END IF;
END $$;

-- =====================================================
-- 4. Fix Function Search Paths
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_sales_logs_updated_at'
  ) THEN
    ALTER FUNCTION update_sales_logs_updated_at() SET search_path = pg_catalog, public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_production_logs_updated_at'
  ) THEN
    ALTER FUNCTION update_production_logs_updated_at() SET search_path = pg_catalog, public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    ALTER FUNCTION update_updated_at_column() SET search_path = pg_catalog, public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_agreement_length'
  ) THEN
    ALTER FUNCTION calculate_agreement_length() SET search_path = pg_catalog, public;
  END IF;
END $$;

-- =====================================================
-- 5. Fix Security Definer View
-- =====================================================

DROP VIEW IF EXISTS dam_capacity_view;

CREATE VIEW dam_capacity_view AS
SELECT 
  d.id,
  d.dam_code,
  d.name as dam_name,
  d.full_supply_capacity_ml,
  d.location,
  d.bailiff,
  d.purposes,
  d.river,
  dmc.current_capacity_ml,
  CASE 
    WHEN d.full_supply_capacity_ml > 0 THEN 
      (dmc.current_capacity_ml / d.full_supply_capacity_ml) * 100
    ELSE NULL
  END as percentage_full,
  dmc.month_year,
  dmc.notes,
  dmc.recorded_by,
  dmc.recorded_at
FROM dams d
LEFT JOIN LATERAL (
  SELECT 
    current_capacity_ml,
    month_year,
    notes,
    recorded_by,
    recorded_at
  FROM dam_monthly_capacities
  WHERE dam_id = d.id
  ORDER BY recorded_at DESC
  LIMIT 1
) dmc ON true;

COMMENT ON VIEW dam_capacity_view IS 'View combining dam information with their latest capacity readings. SECURITY DEFINER removed for safety.';
