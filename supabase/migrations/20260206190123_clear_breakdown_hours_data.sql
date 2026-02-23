/*
  # Clear Breakdown Hours Data

  1. Data Changes
    - Sets all `breakdown_hours` values to 0 in the `production_logs` table
    - The column is retained for potential future use in a different format
    - No structural changes to the table

  2. Notes
    - The Breakdown Hours field has been removed from the production log UI
    - Existing data is being cleared as it will be recaptured in a different format
    - The column default is already 0, so new rows are unaffected
*/

UPDATE production_logs
SET breakdown_hours = 0
WHERE breakdown_hours != 0;
