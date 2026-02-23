/*
  # Sync Production Log New Connections to Client Counts

  1. Purpose
    - Automatically update station client counts when new connections are recorded in production logs
    - Maps connection categories to appropriate client count fields
    - "Local Government" maps to clients_other

  2. Changes
    - Function: update_station_clients_from_production_log()
      - Triggered when production logs are inserted or updated
      - Increments/decrements client counts based on new connections recorded
      - Handles category mapping including "Local Government" -> clients_other

    - Trigger: trigger_update_station_clients_from_production
      - Fires after INSERT or UPDATE on production_logs
      - Only processes records with new_connections > 0 and valid category
*/

-- Function to update station client counts from production log new connections
CREATE OR REPLACE FUNCTION update_station_clients_from_production_log()
RETURNS TRIGGER AS $$
DECLARE
  v_old_connections integer;
  v_old_category text;
  v_new_connections integer;
  v_new_category text;
  v_client_field text;
BEGIN
  -- Get old values (for UPDATE operations)
  IF TG_OP = 'UPDATE' THEN
    v_old_connections := COALESCE(OLD.new_connections, 0);
    v_old_category := OLD.new_connection_category;
  ELSE
    v_old_connections := 0;
    v_old_category := NULL;
  END IF;

  -- Get new values
  v_new_connections := COALESCE(NEW.new_connections, 0);
  v_new_category := NEW.new_connection_category;

  -- First, decrement old category if UPDATE changed the category or connections
  IF TG_OP = 'UPDATE' AND v_old_connections > 0 AND v_old_category IS NOT NULL AND v_old_category <> '' THEN
    -- Map old category to field name
    v_client_field := CASE
      WHEN v_old_category = 'Domestic' THEN 'clients_domestic'
      WHEN v_old_category = 'School' THEN 'clients_school'
      WHEN v_old_category = 'Business' THEN 'clients_business'
      WHEN v_old_category = 'Industry' THEN 'clients_industry'
      WHEN v_old_category = 'Church' THEN 'clients_church'
      WHEN v_old_category = 'Parastatal' THEN 'clients_parastatal'
      WHEN v_old_category = 'Government' THEN 'clients_government'
      WHEN v_old_category IN ('Other', 'Local Government') THEN 'clients_other'
      ELSE NULL
    END;

    -- Decrement old count if field mapping exists
    IF v_client_field IS NOT NULL THEN
      EXECUTE format('
        UPDATE stations
        SET %I = GREATEST(0, COALESCE(%I, 0) - $1),
            updated_at = now()
        WHERE id = $2
      ', v_client_field, v_client_field)
      USING v_old_connections, OLD.station_id;
    END IF;
  END IF;

  -- Then, increment new category if connections > 0 and category is valid
  IF v_new_connections > 0 AND v_new_category IS NOT NULL AND v_new_category <> '' THEN
    -- Map new category to field name
    v_client_field := CASE
      WHEN v_new_category = 'Domestic' THEN 'clients_domestic'
      WHEN v_new_category = 'School' THEN 'clients_school'
      WHEN v_new_category = 'Business' THEN 'clients_business'
      WHEN v_new_category = 'Industry' THEN 'clients_industry'
      WHEN v_new_category = 'Church' THEN 'clients_church'
      WHEN v_new_category = 'Parastatal' THEN 'clients_parastatal'
      WHEN v_new_category = 'Government' THEN 'clients_government'
      WHEN v_new_category IN ('Other', 'Local Government') THEN 'clients_other'
      ELSE NULL
    END;

    -- Increment new count if field mapping exists
    IF v_client_field IS NOT NULL THEN
      EXECUTE format('
        UPDATE stations
        SET %I = COALESCE(%I, 0) + $1,
            updated_at = now()
        WHERE id = $2
      ', v_client_field, v_client_field)
      USING v_new_connections, NEW.station_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_station_clients_from_production ON production_logs;

-- Create trigger to sync on insert or update
CREATE TRIGGER trigger_update_station_clients_from_production
  AFTER INSERT OR UPDATE OF new_connections, new_connection_category ON production_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_station_clients_from_production_log();

-- One-time sync: aggregate all existing production log new connections to station client counts
DO $$
DECLARE
  v_log record;
  v_client_field text;
BEGIN
  -- First, reset all client counts to 0 (we'll recalculate from scratch)
  UPDATE stations SET
    clients_domestic = 0,
    clients_school = 0,
    clients_business = 0,
    clients_industry = 0,
    clients_church = 0,
    clients_parastatal = 0,
    clients_government = 0,
    clients_other = 0;

  -- Re-sync from station_client_groups (the baseline counts)
  FOR v_log IN SELECT DISTINCT station_id FROM station_client_groups
  LOOP
    UPDATE stations
    SET
      clients_domestic = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Domestic'
      ), 0),
      clients_school = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'School'
      ), 0),
      clients_business = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Business'
      ), 0),
      clients_industry = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Industry'
      ), 0),
      clients_church = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Church'
      ), 0),
      clients_parastatal = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Parastatal'
      ), 0),
      clients_government = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category = 'Government'
      ), 0),
      clients_other = COALESCE((
        SELECT SUM(number_of_clients)
        FROM station_client_groups
        WHERE station_id = v_log.station_id AND category IN ('Other', 'Local Government')
      ), 0)
    WHERE id = v_log.station_id;
  END LOOP;

  -- Then add production log new connections on top
  FOR v_log IN
    SELECT station_id, new_connection_category, SUM(new_connections) as total_connections
    FROM production_logs
    WHERE new_connections > 0 AND new_connection_category IS NOT NULL AND new_connection_category <> ''
    GROUP BY station_id, new_connection_category
  LOOP
    -- Map category to field name
    v_client_field := CASE
      WHEN v_log.new_connection_category = 'Domestic' THEN 'clients_domestic'
      WHEN v_log.new_connection_category = 'School' THEN 'clients_school'
      WHEN v_log.new_connection_category = 'Business' THEN 'clients_business'
      WHEN v_log.new_connection_category = 'Industry' THEN 'clients_industry'
      WHEN v_log.new_connection_category = 'Church' THEN 'clients_church'
      WHEN v_log.new_connection_category = 'Parastatal' THEN 'clients_parastatal'
      WHEN v_log.new_connection_category = 'Government' THEN 'clients_government'
      WHEN v_log.new_connection_category IN ('Other', 'Local Government') THEN 'clients_other'
      ELSE NULL
    END;

    -- Increment count if field mapping exists
    IF v_client_field IS NOT NULL THEN
      EXECUTE format('
        UPDATE stations
        SET %I = COALESCE(%I, 0) + $1,
            updated_at = now()
        WHERE id = $2
      ', v_client_field, v_client_field)
      USING v_log.total_connections, v_log.station_id;
    END IF;
  END LOOP;
END $$;
