/*
  # Drop Breakdown Hours Column

  1. Changes
    - Removes the `breakdown_hours` column from the `production_logs` table
    - All data in this column was previously cleared (set to 0)

  2. Notes
    - The breakdown hours field has been removed from the UI
    - Data will be recaptured in a different format in the future
    - This is an explicit user-requested removal after data was cleared
*/

ALTER TABLE production_logs DROP COLUMN IF EXISTS breakdown_hours;
