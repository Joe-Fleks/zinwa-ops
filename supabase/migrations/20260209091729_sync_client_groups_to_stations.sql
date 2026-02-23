/*
  # Sync Client Groups to Stations Table

  1. Purpose
    - Create a function to aggregate station_client_groups data into stations table client columns
    - Create a trigger to automatically sync when client groups are inserted, updated, or deleted
    - This ensures "Local Government" category maps to clients_other column

  2. Changes
    - Function: sync_station_clients_from_groups()
      - Aggregates station_client_groups data by category
      - Maps "Local Government" and "Other" to clients_other
      - Updates the stations table with aggregated counts

    - Trigger: trigger_sync_station_clients
      - Fires after INSERT, UPDATE, or DELETE on station_client_groups
      - Calls sync function to update the related station
*/

-- Function to aggregate and sync client groups to stations table
CREATE OR REPLACE FUNCTION sync_station_clients_from_groups()
RETURNS TRIGGER AS $$
DECLARE
  v_station_id uuid;
BEGIN
  -- Determine which station_id to update
  IF TG_OP = 'DELETE' THEN
    v_station_id := OLD.station_id;
  ELSE
    v_station_id := NEW.station_id;
  END IF;

  -- Aggregate all client groups for this station and update stations table
  UPDATE stations
  SET
    clients_domestic = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Domestic'
    ), 0),
    clients_school = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'School'
    ), 0),
    clients_business = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Business'
    ), 0),
    clients_industry = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Industry'
    ), 0),
    clients_church = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Church'
    ), 0),
    clients_parastatal = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Parastatal'
    ), 0),
    clients_government = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category = 'Government'
    ), 0),
    clients_other = COALESCE((
      SELECT SUM(number_of_clients)
      FROM station_client_groups
      WHERE station_id = v_station_id AND category IN ('Other', 'Local Government')
    ), 0),
    updated_at = now()
  WHERE id = v_station_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_station_clients ON station_client_groups;

-- Create trigger to sync on any change to station_client_groups
CREATE TRIGGER trigger_sync_station_clients
  AFTER INSERT OR UPDATE OR DELETE ON station_client_groups
  FOR EACH ROW
  EXECUTE FUNCTION sync_station_clients_from_groups();

-- Manually sync all existing data
DO $$
DECLARE
  v_station record;
BEGIN
  FOR v_station IN SELECT DISTINCT station_id FROM station_client_groups
  LOOP
    UPDATE stations
    SET
      clients_domestic = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Domestic'
      ), 0),
      clients_school = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'School'
      ), 0),
      clients_business = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Business'
      ), 0),
      clients_industry = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Industry'
      ), 0),
      clients_church = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Church'
      ), 0),
      clients_parastatal = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Parastatal'
      ), 0),
      clients_government = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category = 'Government'
      ), 0),
      clients_other = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_station.station_id AND category IN ('Other', 'Local Government')
      ), 0),
      updated_at = now()
    WHERE id = v_station.station_id;
  END LOOP;
END $$;
