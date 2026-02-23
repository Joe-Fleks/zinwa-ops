/*
  # Remove Old Maintenance Structure

  This migration removes the old maintenance module structure in preparation
  for a new simplified maintenance system focused on risk ranking and backlog.

  ## Tables Being Removed
  
  1. maintenance_records
     - Previously tracked planned and breakdown maintenance activities
     - Contained maintenance history, downtime, costs, and status
  
  2. equipment_register
     - Previously tracked pumps, motors, valves, generators, and other equipment
     - Contained equipment status, serial numbers, and installation dates

  ## Why Remove These Tables
  
  The maintenance module is being restructured to focus on:
  - CW Stations Risk Ranking (operational risk assessment)
  - Maintenance Backlog (future implementation)
  - Dam Maintenance (future implementation)

  ## Data Safety
  
  These tables are being dropped completely. This is intentional as part of the
  module restructure. Future maintenance tracking will use a different schema
  better aligned with operational risk assessment needs.

  ## Important Notes
  
  1. Drop order matters: maintenance_records must be dropped before equipment_register
     due to foreign key constraints
  2. This will not affect other modules (CW, RW, Finance)
  3. The new maintenance structure will be ready for future analytics integration
*/

-- Drop maintenance_records table first (has FK to equipment_register)
DROP TABLE IF EXISTS maintenance_records CASCADE;

-- Drop equipment_register table
DROP TABLE IF EXISTS equipment_register CASCADE;