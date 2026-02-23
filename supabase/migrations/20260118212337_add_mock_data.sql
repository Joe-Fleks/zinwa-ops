/*
  # Add Mock Data for Development and Testing

  ## Overview
  This migration populates the database with sample data for development and demonstration purposes.

  ## Data Added
  - 11 clear water stations
  - Sample daily production records
  - 3 raw water dams
  - 5 raw water users
  - Sample abstraction records
  - Equipment register entries
  - Maintenance records
  - System alerts

  ## Notes
  This is mock data for demonstration purposes only.
*/

-- Insert clear water stations
INSERT INTO clear_water_stations (name, code, location, capacity_m3_per_day, status) VALUES
  ('Murombedzi Central Station', 'MCS-001', 'Murombedzi Central', 2500, 'active'),
  ('Ngezi Treatment Plant', 'NTP-002', 'Ngezi Township', 1800, 'active'),
  ('Kadoma North Station', 'KNS-003', 'Kadoma North', 2200, 'active'),
  ('Rimuka Water Works', 'RWW-004', 'Rimuka Area', 1500, 'active'),
  ('Waverly Pumping Station', 'WPS-005', 'Waverly', 1200, 'active'),
  ('Eiffel Flats Station', 'EFS-006', 'Eiffel Flats', 1600, 'active'),
  ('Chegutu Road Station', 'CRS-007', 'Chegutu Road', 1400, 'active'),
  ('Patchway Station', 'PTS-008', 'Patchway', 1100, 'active'),
  ('Battlefields Station', 'BFS-009', 'Battlefields', 1900, 'active'),
  ('Westgate Treatment Plant', 'WTP-010', 'Westgate', 2000, 'active'),
  ('Lancashire Station', 'LCS-011', 'Lancashire', 1300, 'maintenance')
ON CONFLICT (code) DO NOTHING;

-- Insert sample production data for the last 7 days
DO $$
DECLARE
  station_record RECORD;
  day_offset INTEGER;
  production_volume NUMERIC;
BEGIN
  FOR station_record IN SELECT id FROM clear_water_stations LOOP
    FOR day_offset IN 0..6 LOOP
      production_volume := 800 + (RANDOM() * 400)::INTEGER;
      INSERT INTO station_daily_production (
        station_id,
        date,
        volume_produced_m3,
        pump_runtime_hours,
        labour_headcount,
        notes
      ) VALUES (
        station_record.id,
        CURRENT_DATE - day_offset,
        production_volume,
        14 + (RANDOM() * 8)::INTEGER,
        3 + (RANDOM() * 2)::INTEGER,
        CASE 
          WHEN RANDOM() < 0.3 THEN 'Normal operations'
          WHEN RANDOM() < 0.6 THEN 'Routine maintenance completed'
          ELSE NULL
        END
      ) ON CONFLICT (station_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Insert raw water dams
INSERT INTO raw_water_dams (name, capacity_m3, current_level_percent, location, status) VALUES
  ('Ngezi Dam', 25000000, 78.5, 'Ngezi River, 15km North', 'active'),
  ('Muzvezve Dam', 18000000, 65.2, 'Muzvezve River, 22km East', 'active'),
  ('Dutchman Dam', 12000000, 42.8, 'Kadoma District, 18km South', 'active')
ON CONFLICT DO NOTHING;

-- Insert raw water users
INSERT INTO raw_water_users (name, user_type, permit_number, allocated_volume_m3_per_month) VALUES
  ('Murombedzi Municipality', 'municipal', 'MUN-2024-001', 450000),
  ('Kadoma City Council', 'municipal', 'MUN-2024-002', 380000),
  ('Green Valley Irrigation Scheme', 'agricultural', 'AGR-2024-015', 120000),
  ('Zimbabwe Mining Corporation', 'industrial', 'IND-2024-008', 85000),
  ('Ngezi Platinum Mines', 'industrial', 'IND-2024-012', 150000)
ON CONFLICT DO NOTHING;

-- Insert sample abstraction data
DO $$
DECLARE
  user_record RECORD;
  dam_record RECORD;
  day_offset INTEGER;
BEGIN
  FOR user_record IN SELECT id, allocated_volume_m3_per_month FROM raw_water_users LOOP
    FOR dam_record IN SELECT id FROM raw_water_dams LIMIT 1 LOOP
      FOR day_offset IN 0..6 LOOP
        INSERT INTO raw_water_abstraction (
          user_id,
          dam_id,
          date,
          volume_abstracted_m3,
          notes
        ) VALUES (
          user_record.id,
          dam_record.id,
          CURRENT_DATE - day_offset,
          (user_record.allocated_volume_m3_per_month / 30) * (0.8 + RANDOM() * 0.4),
          NULL
        ) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Insert equipment
DO $$
DECLARE
  station_record RECORD;
  equipment_types TEXT[] := ARRAY['pump', 'motor', 'valve', 'generator'];
  equip_type TEXT;
  counter INTEGER;
BEGIN
  FOR station_record IN SELECT id, name FROM clear_water_stations LIMIT 5 LOOP
    counter := 1;
    FOREACH equip_type IN ARRAY equipment_types LOOP
      INSERT INTO equipment_register (
        equipment_type,
        name,
        serial_number,
        station_id,
        installation_date,
        status
      ) VALUES (
        equip_type,
        station_record.name || ' ' || initcap(equip_type) || ' #' || counter,
        'SN-' || UPPER(SUBSTRING(equip_type FROM 1 FOR 3)) || '-' || LPAD(counter::TEXT, 4, '0'),
        station_record.id,
        CURRENT_DATE - (365 * (1 + RANDOM() * 3))::INTEGER,
        CASE 
          WHEN RANDOM() < 0.8 THEN 'operational'
          WHEN RANDOM() < 0.95 THEN 'maintenance'
          ELSE 'down'
        END
      );
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Insert maintenance records
DO $$
DECLARE
  equipment_record RECORD;
  day_offset INTEGER;
BEGIN
  FOR equipment_record IN SELECT id FROM equipment_register LIMIT 10 LOOP
    FOR day_offset IN 0..2 LOOP
      INSERT INTO maintenance_records (
        equipment_id,
        maintenance_type,
        date,
        description,
        downtime_hours,
        cost,
        status
      ) VALUES (
        equipment_record.id,
        CASE WHEN RANDOM() < 0.7 THEN 'planned' ELSE 'breakdown' END,
        CURRENT_DATE - (day_offset * 15 + (RANDOM() * 10)::INTEGER),
        CASE 
          WHEN RANDOM() < 0.33 THEN 'Routine inspection and lubrication'
          WHEN RANDOM() < 0.66 THEN 'Bearing replacement and alignment check'
          ELSE 'Emergency repair - mechanical failure'
        END,
        CASE WHEN RANDOM() < 0.7 THEN (RANDOM() * 4)::NUMERIC ELSE (4 + RANDOM() * 20)::NUMERIC END,
        (50 + RANDOM() * 500)::NUMERIC,
        CASE 
          WHEN RANDOM() < 0.7 THEN 'completed'
          WHEN RANDOM() < 0.9 THEN 'in_progress'
          ELSE 'pending'
        END
      );
    END LOOP;
  END LOOP;
END $$;

-- Insert sample alerts
INSERT INTO alerts (title, message, severity, is_active) VALUES
  ('Low Dam Level Warning', 'Dutchman Dam level has dropped below 45%. Consider water restrictions.', 'warning', true),
  ('Maintenance Due', 'Lancashire Station scheduled for quarterly maintenance this week.', 'info', true),
  ('High Downtime Alert', 'Equipment downtime exceeded threshold at Eiffel Flats Station.', 'critical', true)
ON CONFLICT DO NOTHING;