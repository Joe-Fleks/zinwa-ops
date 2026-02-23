/*
  # Remove Catchment Column from Dams Table

  1. Changes
    - Removes the `catchment` column from the `dams` table
    - Service Centre association (via `service_centre_id`) will be used instead to identify dams in a catchment
    - Service Centres are already linked to catchments through the `service_centres` table

  2. Rationale
    - Eliminates redundant catchment field
    - Uses proper relational structure: dams -> service_centres -> catchments
    - Maintains data integrity through foreign key relationships
*/

-- Remove the catchment column from dams table
ALTER TABLE dams DROP COLUMN IF EXISTS catchment;
