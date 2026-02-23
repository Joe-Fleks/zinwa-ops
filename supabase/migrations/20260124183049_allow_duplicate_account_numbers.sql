/*
  # Allow Duplicate Account Numbers in Water Users

  ## Changes
  This migration modifies the water_users table to allow duplicate and empty account numbers:
  
  1. Modifications to `water_users` table
    - Remove UNIQUE constraint from account_no column
    - Remove NOT NULL constraint from account_no column
    - Remove account_no_not_empty check constraint
    - Account numbers can now be duplicated or left empty to be filled in later
  
  ## Rationale
  Users need flexibility to:
  - Register water users with duplicate account numbers (to be adjusted later)
  - Leave account numbers empty during initial registration
  - Update account numbers after initial data entry
*/

-- Drop the NOT NULL constraint and UNIQUE constraint on account_no
ALTER TABLE water_users ALTER COLUMN account_no DROP NOT NULL;
ALTER TABLE water_users DROP CONSTRAINT IF EXISTS water_users_account_no_key;

-- Drop the check constraint that requires account_no to not be empty
ALTER TABLE water_users DROP CONSTRAINT IF EXISTS account_no_not_empty;
