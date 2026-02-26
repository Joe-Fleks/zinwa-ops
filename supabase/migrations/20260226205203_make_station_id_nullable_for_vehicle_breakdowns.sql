/*
  # Make station_id nullable on station_breakdowns for vehicle breakdowns

  1. Modified Tables
    - `station_breakdowns`
      - `station_id` changed from NOT NULL to nullable
      - This allows vehicle breakdowns (linked via `vehicle_id`) to exist
        without being tied to a specific station, since SC vehicles
        serve all stations under the service centre

  2. Notes
    - Existing records with station_id populated remain unchanged
    - Vehicle breakdowns (where vehicle_id IS NOT NULL) may have station_id = NULL
    - Station-specific breakdowns still require station_id
*/

ALTER TABLE station_breakdowns ALTER COLUMN station_id DROP NOT NULL;
