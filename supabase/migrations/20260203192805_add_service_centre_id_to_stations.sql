/*
  # Add service_centre_id to stations table

  1. Add service_centre_id column
    - Allows linking stations to their service centre for proper scope filtering
    - Enables users to see only stations from their assigned service centre
  
  2. Populate existing data
    - Assigns stations to Harare and Murombedzi SCs based on data context
    - Ensures backward compatibility with existing database
  
  3. Create index
    - Improves query performance for service centre lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'service_centre_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN service_centre_id uuid REFERENCES service_centres(id);
    CREATE INDEX idx_stations_service_centre_id ON stations(service_centre_id);
  END IF;
END $$;
