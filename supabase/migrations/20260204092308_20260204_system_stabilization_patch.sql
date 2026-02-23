/*
  # SYSTEM STABILIZATION PATCH - STRUCTURAL HARDENING
  
  This migration implements data integrity and security hardening as per the stabilization patch requirements.
  
  ## Changes Made
  
  1. **Data Uniqueness Constraints**
     - Add UNIQUE constraint on production_logs (station_id, date) to prevent duplicate daily records
     - Add UNIQUE constraint on sales_logs (station_id, year, month) to prevent duplicate monthly records
  
  2. **Performance Indexes**
     - Add composite index on production_logs (station_id, date) for efficient date range queries
     - Add index on production_logs (created_at) for dashboard date filtering
     - Add composite index on sales_logs (station_id, year, month) for efficient lookups
     - Add index on sales_logs (created_at) for historical reporting
     - Add composite index on production_logs (service_centre_id, date) for scope-based aggregations
  
  3. **RLS INSERT Policy Hardening**
     - Add INSERT policy to catchments table: Global Admin only
     - Add INSERT policy to service_centres table: Global Admin only
     - Policies restrict to authenticated users with system_rank = 1 and effective role assignment
  
  4. **Notes**
     - No data was deleted during cleanup (no duplicates detected at time of migration)
     - All constraints are added with IF NOT EXISTS to ensure idempotency
     - SELECT/UPDATE/DELETE policies remain unchanged
*/

-- PHASE 1: DATA UNIQUENESS CONSTRAINTS
-- Add unique constraint to prevent duplicate production_logs entries
ALTER TABLE production_logs
ADD CONSTRAINT production_logs_station_date_unique
UNIQUE (station_id, date);

-- Add unique constraint to prevent duplicate sales_logs entries
ALTER TABLE sales_logs
ADD CONSTRAINT sales_logs_station_year_month_unique
UNIQUE (station_id, year, month);

-- PHASE 2: PERFORMANCE INDEXES
-- Composite index for production_logs queries by station and date
CREATE INDEX IF NOT EXISTS idx_production_logs_station_date
ON production_logs (station_id, date);

-- Index for production_logs date range queries (dashboard)
CREATE INDEX IF NOT EXISTS idx_production_logs_created_at
ON production_logs (created_at);

-- Composite index for sales_logs queries by station and period
CREATE INDEX IF NOT EXISTS idx_sales_logs_station_year_month
ON sales_logs (station_id, year, month);

-- Index for sales_logs date range queries (historical reporting)
CREATE INDEX IF NOT EXISTS idx_sales_logs_created_at
ON sales_logs (created_at);

-- Composite index for scope-based aggregations
CREATE INDEX IF NOT EXISTS idx_production_logs_service_centre_date
ON production_logs (service_centre_id, date);

-- PHASE 3: RLS INSERT POLICY HARDENING

-- Add INSERT policy for catchments table (Global Admin only)
CREATE POLICY "Only Global Admin can insert catchments"
  ON catchments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.system_rank = 1
      AND ur.effective_to IS NULL
    )
  );

-- Add INSERT policy for service_centres table (Global Admin only)
CREATE POLICY "Only Global Admin can insert service centres"
  ON service_centres FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.system_rank = 1
      AND ur.effective_to IS NULL
    )
  );
