/*
  # Drop sales_logs table

  1. Data Removal
    - Truncates all data from `sales_logs` table
    - Drops the `sales_logs` table entirely

  2. Cleanup
    - Removes all associated RLS policies
    - Removes all associated indexes and triggers
    - Cascades to remove foreign key references

  3. Notes
    - This is intentional as the sales capture system is being rebuilt from scratch
*/

DROP TABLE IF EXISTS sales_logs CASCADE;
