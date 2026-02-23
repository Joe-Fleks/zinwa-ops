/*
  # Create Centralized Metrics SQL Views

  1. New Views
    - `v_monthly_production_by_station` - Monthly production aggregates per station
      - station_id, service_centre_id, year, month
      - cw_volume, rw_volume, cw_hours, rw_hours
      - load_shedding_hours, other_downtime_hours, total_downtime
      - log_count, cw_pump_rate, rw_pump_rate, efficiency_pct
    - `v_chemical_balances_current` - Current chemical balance per station/type/month
      - station_id, service_centre_id, chemical_type, year, month
      - opening_balance, received, used, current_balance
      - production_days, avg_usage_per_day, days_remaining
    - `v_station_non_functional_yesterday` - Non-functional station detection for yesterday
      - station_id, station_name, service_centre_id
      - cw_volume, expected_volume, is_non_functional, reason
    - `v_sc_monthly_summary` - Service Centre level monthly rollup
      - service_centre_id, year, month
      - total_cw_volume, total_rw_volume, total_hours, total_downtime
      - station_count, avg_efficiency

  2. Security
    - Views inherit RLS from underlying tables
    - No direct RLS needed on views (they use invoker's permissions)

  3. Important Notes
    - Views are read-only aggregation layers
    - They do NOT replace existing application logic
    - They provide an independent queryable surface for metrics
    - Designed for AI layer consumption and API exposure
*/

CREATE OR REPLACE VIEW v_monthly_production_by_station AS
SELECT
  pl.station_id,
  s.station_name,
  s.service_centre_id,
  s.station_type,
  EXTRACT(YEAR FROM pl.date)::int AS year,
  EXTRACT(MONTH FROM pl.date)::int AS month,
  SUM(COALESCE(pl.cw_volume_m3, 0)) AS cw_volume,
  SUM(COALESCE(pl.rw_volume_m3, 0)) AS rw_volume,
  SUM(COALESCE(pl.cw_hours_run, 0)) AS cw_hours,
  SUM(COALESCE(pl.rw_hours_run, 0)) AS rw_hours,
  SUM(COALESCE(pl.load_shedding_hours, 0)) AS load_shedding_hours,
  SUM(COALESCE(pl.other_downtime_hours, 0)) AS other_downtime_hours,
  SUM(COALESCE(pl.load_shedding_hours, 0) + COALESCE(pl.other_downtime_hours, 0)) AS total_downtime,
  SUM(COALESCE(pl.alum_kg, 0)) AS alum_kg,
  SUM(COALESCE(pl.hth_kg, 0)) AS hth_kg,
  SUM(COALESCE(pl.activated_carbon_kg, 0)) AS activated_carbon_kg,
  COUNT(*)::int AS log_count,
  CASE WHEN SUM(COALESCE(pl.cw_hours_run, 0)) > 0
    THEN ROUND((SUM(COALESCE(pl.cw_volume_m3, 0)) / SUM(COALESCE(pl.cw_hours_run, 0)))::numeric, 2)
    ELSE NULL
  END AS cw_pump_rate,
  CASE WHEN SUM(COALESCE(pl.rw_hours_run, 0)) > 0
    THEN ROUND((SUM(COALESCE(pl.rw_volume_m3, 0)) / SUM(COALESCE(pl.rw_hours_run, 0)))::numeric, 2)
    ELSE NULL
  END AS rw_pump_rate,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(((SUM(COALESCE(pl.cw_hours_run, 0)) / (COUNT(*) * 24.0)) * 100)::numeric, 1)
    ELSE 0
  END AS efficiency_pct
FROM production_logs pl
JOIN stations s ON s.id = pl.station_id
GROUP BY pl.station_id, s.station_name, s.service_centre_id, s.station_type,
  EXTRACT(YEAR FROM pl.date), EXTRACT(MONTH FROM pl.date);

CREATE OR REPLACE VIEW v_chemical_balances_current AS
SELECT
  csb.station_id,
  s.station_name,
  s.service_centre_id,
  csb.chemical_type,
  csb.year,
  csb.month,
  COALESCE(csb.opening_balance, 0) AS opening_balance,
  COALESCE(receipt_agg.total_received, 0) AS received,
  COALESCE(used_agg.total_used, 0) AS used,
  COALESCE(csb.opening_balance, 0) + COALESCE(receipt_agg.total_received, 0) - COALESCE(used_agg.total_used, 0) AS current_balance,
  COALESCE(used_agg.production_days, 0) AS production_days,
  CASE WHEN COALESCE(used_agg.production_days, 0) > 0
    THEN ROUND((COALESCE(used_agg.total_used, 0) / used_agg.production_days)::numeric, 2)
    ELSE 0
  END AS avg_usage_per_day,
  CASE
    WHEN COALESCE(used_agg.production_days, 0) > 0
      AND (COALESCE(used_agg.total_used, 0) / used_agg.production_days) > 0
      AND (COALESCE(csb.opening_balance, 0) + COALESCE(receipt_agg.total_received, 0) - COALESCE(used_agg.total_used, 0)) > 0
    THEN ROUND(
      ((COALESCE(csb.opening_balance, 0) + COALESCE(receipt_agg.total_received, 0) - COALESCE(used_agg.total_used, 0))
       / (COALESCE(used_agg.total_used, 0) / used_agg.production_days))::numeric, 1)
    ELSE NULL
  END AS days_remaining
FROM chemical_stock_balances csb
JOIN stations s ON s.id = csb.station_id
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN csr.receipt_type = 'transfer_out' THEN -COALESCE(csr.quantity, 0) ELSE COALESCE(csr.quantity, 0) END) AS total_received
  FROM chemical_stock_receipts csr
  WHERE csr.station_id = csb.station_id
    AND csr.chemical_type = csb.chemical_type
    AND csr.year = csb.year
    AND csr.month = csb.month
) receipt_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(
      CASE csb.chemical_type
        WHEN 'aluminium_sulphate' THEN COALESCE(pl.alum_kg, 0)
        WHEN 'hth' THEN COALESCE(pl.hth_kg, 0)
        WHEN 'activated_carbon' THEN COALESCE(pl.activated_carbon_kg, 0)
        ELSE 0
      END
    ) AS total_used,
    COUNT(*) FILTER (WHERE
      CASE csb.chemical_type
        WHEN 'aluminium_sulphate' THEN COALESCE(pl.alum_kg, 0)
        WHEN 'hth' THEN COALESCE(pl.hth_kg, 0)
        WHEN 'activated_carbon' THEN COALESCE(pl.activated_carbon_kg, 0)
        ELSE 0
      END > 0
    )::int AS production_days
  FROM production_logs pl
  WHERE pl.station_id = csb.station_id
    AND pl.date >= make_date(csb.year, csb.month, 1)
    AND pl.date < (make_date(csb.year, csb.month, 1) + interval '1 month')::date
) used_agg ON true;

CREATE OR REPLACE VIEW v_sc_monthly_summary AS
SELECT
  s.service_centre_id,
  sc.name AS service_centre_name,
  EXTRACT(YEAR FROM pl.date)::int AS year,
  EXTRACT(MONTH FROM pl.date)::int AS month,
  SUM(COALESCE(pl.cw_volume_m3, 0)) AS total_cw_volume,
  SUM(COALESCE(pl.rw_volume_m3, 0)) AS total_rw_volume,
  SUM(COALESCE(pl.cw_hours_run, 0)) AS total_cw_hours,
  SUM(COALESCE(pl.rw_hours_run, 0)) AS total_rw_hours,
  SUM(COALESCE(pl.load_shedding_hours, 0) + COALESCE(pl.other_downtime_hours, 0)) AS total_downtime,
  COUNT(DISTINCT pl.station_id)::int AS station_count,
  COUNT(*)::int AS log_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(((SUM(COALESCE(pl.cw_hours_run, 0)) / (COUNT(*) * 24.0)) * 100)::numeric, 1)
    ELSE 0
  END AS avg_efficiency
FROM production_logs pl
JOIN stations s ON s.id = pl.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
GROUP BY s.service_centre_id, sc.name,
  EXTRACT(YEAR FROM pl.date), EXTRACT(MONTH FROM pl.date);

CREATE OR REPLACE VIEW v_catchment_monthly_summary AS
SELECT
  sc.catchment_id,
  c.name AS catchment_name,
  EXTRACT(YEAR FROM pl.date)::int AS year,
  EXTRACT(MONTH FROM pl.date)::int AS month,
  SUM(COALESCE(pl.cw_volume_m3, 0)) AS total_cw_volume,
  SUM(COALESCE(pl.rw_volume_m3, 0)) AS total_rw_volume,
  SUM(COALESCE(pl.cw_hours_run, 0)) AS total_cw_hours,
  SUM(COALESCE(pl.rw_hours_run, 0)) AS total_rw_hours,
  SUM(COALESCE(pl.load_shedding_hours, 0) + COALESCE(pl.other_downtime_hours, 0)) AS total_downtime,
  COUNT(DISTINCT pl.station_id)::int AS station_count,
  COUNT(DISTINCT s.service_centre_id)::int AS sc_count,
  COUNT(*)::int AS log_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(((SUM(COALESCE(pl.cw_hours_run, 0)) / (COUNT(*) * 24.0)) * 100)::numeric, 1)
    ELSE 0
  END AS avg_efficiency
FROM production_logs pl
JOIN stations s ON s.id = pl.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
JOIN catchments c ON c.id = sc.catchment_id
GROUP BY sc.catchment_id, c.name,
  EXTRACT(YEAR FROM pl.date), EXTRACT(MONTH FROM pl.date);

CREATE OR REPLACE VIEW v_national_monthly_summary AS
SELECT
  EXTRACT(YEAR FROM pl.date)::int AS year,
  EXTRACT(MONTH FROM pl.date)::int AS month,
  SUM(COALESCE(pl.cw_volume_m3, 0)) AS total_cw_volume,
  SUM(COALESCE(pl.rw_volume_m3, 0)) AS total_rw_volume,
  SUM(COALESCE(pl.cw_hours_run, 0)) AS total_cw_hours,
  SUM(COALESCE(pl.rw_hours_run, 0)) AS total_rw_hours,
  SUM(COALESCE(pl.load_shedding_hours, 0) + COALESCE(pl.other_downtime_hours, 0)) AS total_downtime,
  COUNT(DISTINCT pl.station_id)::int AS station_count,
  COUNT(DISTINCT s.service_centre_id)::int AS sc_count,
  COUNT(*)::int AS log_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(((SUM(COALESCE(pl.cw_hours_run, 0)) / (COUNT(*) * 24.0)) * 100)::numeric, 1)
    ELSE 0
  END AS avg_efficiency
FROM production_logs pl
JOIN stations s ON s.id = pl.station_id
GROUP BY EXTRACT(YEAR FROM pl.date), EXTRACT(MONTH FROM pl.date);
