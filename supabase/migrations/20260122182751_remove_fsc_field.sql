/*
  # Remove FSC Field from Dams Table

  1. Changes
    - Drop the fsc column from dams table
    
  2. Reason
    - Field was added in error and not requested by user
*/

-- Remove FSC field from dams table
ALTER TABLE dams DROP COLUMN IF EXISTS fsc;
