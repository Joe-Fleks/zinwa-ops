/*
  # Create Sales Data & Sales Targets Metrics Views

  Comprehensive SQL views for CW and RW sales data and targets, providing
  monthly, quarterly, and yearly aggregation at station, service centre,
  catchment, and national levels.

  1. New Views

    ## CW Sales (actual sales from sales_records table)
    - `v_cw_sales_monthly_by_station` - Per-station monthly CW sales
    - `v_cw_sales_monthly_by_sc` - Service Centre monthly CW sales rollup
    - `v_cw_sales_quarterly_by_station` - Per-station quarterly CW sales
    - `v_cw_sales_quarterly_by_sc` - Service Centre quarterly CW sales rollup
    - `v_cw_sales_yearly_by_station` - Per-station yearly CW sales
    - `v_cw_sales_yearly_by_sc` - Service Centre yearly CW sales rollup

    ## CW Sales Targets (from cw_sales_targets jan-dec columns)
    - `v_cw_sales_targets_monthly_by_station` - Per-station monthly CW sales targets
    - `v_cw_sales_targets_monthly_by_sc` - Service Centre monthly CW sales targets rollup
    - `v_cw_sales_targets_quarterly_by_station` - Per-station quarterly CW sales targets
    - `v_cw_sales_targets_quarterly_by_sc` - Service Centre quarterly CW sales targets rollup
    - `v_cw_sales_targets_yearly_by_station` - Per-station yearly CW sales targets
    - `v_cw_sales_targets_yearly_by_sc` - Service Centre yearly CW sales targets rollup

    ## RW Sales (from rw_sales_data jan-dec columns)
    - `v_rw_sales_monthly_by_dam` - Per-dam monthly RW sales
    - `v_rw_sales_monthly_by_sc` - Service Centre monthly RW sales rollup
    - `v_rw_sales_quarterly_by_dam` - Per-dam quarterly RW sales
    - `v_rw_sales_quarterly_by_sc` - Service Centre quarterly RW sales rollup
    - `v_rw_sales_yearly_by_dam` - Per-dam yearly RW sales
    - `v_rw_sales_yearly_by_sc` - Service Centre yearly RW sales rollup

    ## RW Sales Targets (from rw_sales_targets jan-dec columns)
    - `v_rw_sales_targets_monthly_by_dam` - Per-dam monthly RW sales targets
    - `v_rw_sales_targets_monthly_by_sc` - Service Centre monthly RW sales targets rollup
    - `v_rw_sales_targets_quarterly_by_dam` - Per-dam quarterly RW sales targets
    - `v_rw_sales_targets_quarterly_by_sc` - Service Centre quarterly RW sales targets rollup
    - `v_rw_sales_targets_yearly_by_dam` - Per-dam yearly RW sales targets
    - `v_rw_sales_targets_yearly_by_sc` - Service Centre yearly RW sales targets rollup

    ## Combined Actual vs Target
    - `v_cw_sales_vs_target_monthly` - CW monthly actual vs target per station with variance
    - `v_rw_sales_vs_target_monthly` - RW monthly actual vs target per dam with variance

  2. Security
    - Views inherit RLS from underlying tables
    - No direct RLS needed on views

  3. Important Notes
    - CW sales use sales_records (station_id, year, month, returns_volume_m3, sage_sales_volume_m3)
    - CW/RW targets and RW sales data use jan-dec columnar format, unpivoted via LATERAL joins
    - Quarterly: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
    - All numeric results rounded to 2 decimal places
    - Dams link to service_centres via dams.service_centre_id
    - Stations link to service_centres via stations.service_centre_id
*/

-- ============================================================
-- HELPER: Month-name array for unpivoting jan-dec columns
-- ============================================================

-- ============================================================
-- CW SALES (ACTUAL) VIEWS
-- Source: sales_records (station_id, year, month, returns_volume_m3, sage_sales_volume_m3)
-- ============================================================

-- Monthly by station
CREATE OR REPLACE VIEW v_cw_sales_monthly_by_station AS
SELECT
  sr.station_id,
  s.station_name,
  s.station_type,
  s.service_centre_id,
  sr.year,
  sr.month,
  COALESCE(sr.returns_volume_m3, 0) AS returns_volume_m3,
  COALESCE(sr.sage_sales_volume_m3, 0) AS sage_sales_volume_m3,
  CASE
    WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
    ELSE COALESCE(sr.returns_volume_m3, 0)
  END AS effective_sales_volume_m3
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id;

-- Monthly by SC
CREATE OR REPLACE VIEW v_cw_sales_monthly_by_sc AS
SELECT
  s.service_centre_id,
  sc.name AS service_centre_name,
  sr.year,
  sr.month,
  COUNT(DISTINCT sr.station_id)::int AS station_count,
  ROUND(SUM(COALESCE(sr.returns_volume_m3, 0))::numeric, 2) AS total_returns_volume_m3,
  ROUND(SUM(COALESCE(sr.sage_sales_volume_m3, 0))::numeric, 2) AS total_sage_sales_volume_m3,
  ROUND(SUM(
    CASE
      WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
      ELSE COALESCE(sr.returns_volume_m3, 0)
    END
  )::numeric, 2) AS total_effective_sales_volume_m3
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
GROUP BY s.service_centre_id, sc.name, sr.year, sr.month;

-- Quarterly by station
CREATE OR REPLACE VIEW v_cw_sales_quarterly_by_station AS
SELECT
  sr.station_id,
  s.station_name,
  s.station_type,
  s.service_centre_id,
  sr.year,
  CEIL(sr.month / 3.0)::int AS quarter,
  ROUND(SUM(COALESCE(sr.returns_volume_m3, 0))::numeric, 2) AS returns_volume_m3,
  ROUND(SUM(COALESCE(sr.sage_sales_volume_m3, 0))::numeric, 2) AS sage_sales_volume_m3,
  ROUND(SUM(
    CASE
      WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
      ELSE COALESCE(sr.returns_volume_m3, 0)
    END
  )::numeric, 2) AS effective_sales_volume_m3
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id
GROUP BY sr.station_id, s.station_name, s.station_type, s.service_centre_id, sr.year, CEIL(sr.month / 3.0)::int;

-- Quarterly by SC
CREATE OR REPLACE VIEW v_cw_sales_quarterly_by_sc AS
SELECT
  s.service_centre_id,
  sc.name AS service_centre_name,
  sr.year,
  CEIL(sr.month / 3.0)::int AS quarter,
  COUNT(DISTINCT sr.station_id)::int AS station_count,
  ROUND(SUM(COALESCE(sr.returns_volume_m3, 0))::numeric, 2) AS total_returns_volume_m3,
  ROUND(SUM(COALESCE(sr.sage_sales_volume_m3, 0))::numeric, 2) AS total_sage_sales_volume_m3,
  ROUND(SUM(
    CASE
      WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
      ELSE COALESCE(sr.returns_volume_m3, 0)
    END
  )::numeric, 2) AS total_effective_sales_volume_m3
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
GROUP BY s.service_centre_id, sc.name, sr.year, CEIL(sr.month / 3.0)::int;

-- Yearly by station
CREATE OR REPLACE VIEW v_cw_sales_yearly_by_station AS
SELECT
  sr.station_id,
  s.station_name,
  s.station_type,
  s.service_centre_id,
  sr.year,
  ROUND(SUM(COALESCE(sr.returns_volume_m3, 0))::numeric, 2) AS returns_volume_m3,
  ROUND(SUM(COALESCE(sr.sage_sales_volume_m3, 0))::numeric, 2) AS sage_sales_volume_m3,
  ROUND(SUM(
    CASE
      WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
      ELSE COALESCE(sr.returns_volume_m3, 0)
    END
  )::numeric, 2) AS effective_sales_volume_m3,
  COUNT(*)::int AS months_with_data
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id
GROUP BY sr.station_id, s.station_name, s.station_type, s.service_centre_id, sr.year;

-- Yearly by SC
CREATE OR REPLACE VIEW v_cw_sales_yearly_by_sc AS
SELECT
  s.service_centre_id,
  sc.name AS service_centre_name,
  sr.year,
  COUNT(DISTINCT sr.station_id)::int AS station_count,
  ROUND(SUM(COALESCE(sr.returns_volume_m3, 0))::numeric, 2) AS total_returns_volume_m3,
  ROUND(SUM(COALESCE(sr.sage_sales_volume_m3, 0))::numeric, 2) AS total_sage_sales_volume_m3,
  ROUND(SUM(
    CASE
      WHEN COALESCE(sr.sage_sales_volume_m3, 0) > 0 THEN sr.sage_sales_volume_m3
      ELSE COALESCE(sr.returns_volume_m3, 0)
    END
  )::numeric, 2) AS total_effective_sales_volume_m3,
  COUNT(*)::int AS total_records
FROM sales_records sr
JOIN stations s ON s.id = sr.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
GROUP BY s.service_centre_id, sc.name, sr.year;


-- ============================================================
-- CW SALES TARGETS VIEWS
-- Source: cw_sales_targets (station_id, year, jan..dec columns)
-- Unpivoted using LATERAL to normalize into monthly rows
-- ============================================================

-- Monthly by station
CREATE OR REPLACE VIEW v_cw_sales_targets_monthly_by_station AS
SELECT
  t.station_id,
  s.station_name,
  s.station_type,
  s.service_centre_id,
  t.year,
  m.month,
  m.target_volume_m3
FROM cw_sales_targets t
JOIN stations s ON s.id = t.station_id
CROSS JOIN LATERAL (
  VALUES (1, t.jan), (2, t.feb), (3, t.mar), (4, t.apr),
         (5, t.may), (6, t.jun), (7, t.jul), (8, t.aug),
         (9, t.sep), (10, t.oct), (11, t.nov), (12, t.dec)
) AS m(month, target_volume_m3);

-- Monthly by SC
CREATE OR REPLACE VIEW v_cw_sales_targets_monthly_by_sc AS
SELECT
  s.service_centre_id,
  sc.name AS service_centre_name,
  t.year,
  m.month,
  COUNT(DISTINCT t.station_id)::int AS station_count,
  ROUND(SUM(COALESCE(m.target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM cw_sales_targets t
JOIN stations s ON s.id = t.station_id
JOIN service_centres sc ON sc.id = s.service_centre_id
CROSS JOIN LATERAL (
  VALUES (1, t.jan), (2, t.feb), (3, t.mar), (4, t.apr),
         (5, t.may), (6, t.jun), (7, t.jul), (8, t.aug),
         (9, t.sep), (10, t.oct), (11, t.nov), (12, t.dec)
) AS m(month, target_volume_m3)
GROUP BY s.service_centre_id, sc.name, t.year, m.month;

-- Quarterly by station
CREATE OR REPLACE VIEW v_cw_sales_targets_quarterly_by_station AS
SELECT
  station_id,
  station_name,
  station_type,
  service_centre_id,
  year,
  CEIL(month / 3.0)::int AS quarter,
  ROUND(SUM(COALESCE(target_volume_m3, 0))::numeric, 2) AS target_volume_m3
FROM v_cw_sales_targets_monthly_by_station
GROUP BY station_id, station_name, station_type, service_centre_id, year, CEIL(month / 3.0)::int;

-- Quarterly by SC
CREATE OR REPLACE VIEW v_cw_sales_targets_quarterly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  CEIL(month / 3.0)::int AS quarter,
  MAX(station_count) AS station_count,
  ROUND(SUM(COALESCE(total_target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM v_cw_sales_targets_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year, CEIL(month / 3.0)::int;

-- Yearly by station
CREATE OR REPLACE VIEW v_cw_sales_targets_yearly_by_station AS
SELECT
  station_id,
  station_name,
  station_type,
  service_centre_id,
  year,
  ROUND(SUM(COALESCE(target_volume_m3, 0))::numeric, 2) AS target_volume_m3
FROM v_cw_sales_targets_monthly_by_station
GROUP BY station_id, station_name, station_type, service_centre_id, year;

-- Yearly by SC
CREATE OR REPLACE VIEW v_cw_sales_targets_yearly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  MAX(station_count) AS station_count,
  ROUND(SUM(COALESCE(total_target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM v_cw_sales_targets_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year;


-- ============================================================
-- RW SALES (ACTUAL) VIEWS
-- Source: rw_sales_data (dam_id, year, jan..dec columns)
-- Dams link to service_centres via dams.service_centre_id
-- ============================================================

-- Monthly by dam
CREATE OR REPLACE VIEW v_rw_sales_monthly_by_dam AS
SELECT
  rsd.dam_id,
  d.name AS dam_name,
  d.service_centre_id,
  rsd.year,
  m.month,
  COALESCE(m.sales_volume_m3, 0) AS sales_volume_m3
FROM rw_sales_data rsd
JOIN dams d ON d.id = rsd.dam_id
CROSS JOIN LATERAL (
  VALUES (1, rsd.jan), (2, rsd.feb), (3, rsd.mar), (4, rsd.apr),
         (5, rsd.may), (6, rsd.jun), (7, rsd.jul), (8, rsd.aug),
         (9, rsd.sep), (10, rsd.oct), (11, rsd.nov), (12, rsd.dec)
) AS m(month, sales_volume_m3);

-- Monthly by SC
CREATE OR REPLACE VIEW v_rw_sales_monthly_by_sc AS
SELECT
  d.service_centre_id,
  sc.name AS service_centre_name,
  rsd.year,
  m.month,
  COUNT(DISTINCT rsd.dam_id)::int AS dam_count,
  ROUND(SUM(COALESCE(m.sales_volume_m3, 0))::numeric, 2) AS total_sales_volume_m3
FROM rw_sales_data rsd
JOIN dams d ON d.id = rsd.dam_id
JOIN service_centres sc ON sc.id = d.service_centre_id
CROSS JOIN LATERAL (
  VALUES (1, rsd.jan), (2, rsd.feb), (3, rsd.mar), (4, rsd.apr),
         (5, rsd.may), (6, rsd.jun), (7, rsd.jul), (8, rsd.aug),
         (9, rsd.sep), (10, rsd.oct), (11, rsd.nov), (12, rsd.dec)
) AS m(month, sales_volume_m3)
GROUP BY d.service_centre_id, sc.name, rsd.year, m.month;

-- Quarterly by dam
CREATE OR REPLACE VIEW v_rw_sales_quarterly_by_dam AS
SELECT
  dam_id,
  dam_name,
  service_centre_id,
  year,
  CEIL(month / 3.0)::int AS quarter,
  ROUND(SUM(COALESCE(sales_volume_m3, 0))::numeric, 2) AS sales_volume_m3
FROM v_rw_sales_monthly_by_dam
GROUP BY dam_id, dam_name, service_centre_id, year, CEIL(month / 3.0)::int;

-- Quarterly by SC
CREATE OR REPLACE VIEW v_rw_sales_quarterly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  CEIL(month / 3.0)::int AS quarter,
  MAX(dam_count) AS dam_count,
  ROUND(SUM(COALESCE(total_sales_volume_m3, 0))::numeric, 2) AS total_sales_volume_m3
FROM v_rw_sales_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year, CEIL(month / 3.0)::int;

-- Yearly by dam
CREATE OR REPLACE VIEW v_rw_sales_yearly_by_dam AS
SELECT
  dam_id,
  dam_name,
  service_centre_id,
  year,
  ROUND(SUM(COALESCE(sales_volume_m3, 0))::numeric, 2) AS sales_volume_m3
FROM v_rw_sales_monthly_by_dam
GROUP BY dam_id, dam_name, service_centre_id, year;

-- Yearly by SC
CREATE OR REPLACE VIEW v_rw_sales_yearly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  MAX(dam_count) AS dam_count,
  ROUND(SUM(COALESCE(total_sales_volume_m3, 0))::numeric, 2) AS total_sales_volume_m3
FROM v_rw_sales_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year;


-- ============================================================
-- RW SALES TARGETS VIEWS
-- Source: rw_sales_targets (dam_id, year, jan..dec columns)
-- ============================================================

-- Monthly by dam
CREATE OR REPLACE VIEW v_rw_sales_targets_monthly_by_dam AS
SELECT
  t.dam_id,
  d.name AS dam_name,
  d.service_centre_id,
  t.year,
  m.month,
  COALESCE(m.target_volume_m3, 0) AS target_volume_m3
FROM rw_sales_targets t
JOIN dams d ON d.id = t.dam_id
CROSS JOIN LATERAL (
  VALUES (1, t.jan), (2, t.feb), (3, t.mar), (4, t.apr),
         (5, t.may), (6, t.jun), (7, t.jul), (8, t.aug),
         (9, t.sep), (10, t.oct), (11, t.nov), (12, t.dec)
) AS m(month, target_volume_m3);

-- Monthly by SC
CREATE OR REPLACE VIEW v_rw_sales_targets_monthly_by_sc AS
SELECT
  d.service_centre_id,
  sc.name AS service_centre_name,
  t.year,
  m.month,
  COUNT(DISTINCT t.dam_id)::int AS dam_count,
  ROUND(SUM(COALESCE(m.target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM rw_sales_targets t
JOIN dams d ON d.id = t.dam_id
JOIN service_centres sc ON sc.id = d.service_centre_id
CROSS JOIN LATERAL (
  VALUES (1, t.jan), (2, t.feb), (3, t.mar), (4, t.apr),
         (5, t.may), (6, t.jun), (7, t.jul), (8, t.aug),
         (9, t.sep), (10, t.oct), (11, t.nov), (12, t.dec)
) AS m(month, target_volume_m3)
GROUP BY d.service_centre_id, sc.name, t.year, m.month;

-- Quarterly by dam
CREATE OR REPLACE VIEW v_rw_sales_targets_quarterly_by_dam AS
SELECT
  dam_id,
  dam_name,
  service_centre_id,
  year,
  CEIL(month / 3.0)::int AS quarter,
  ROUND(SUM(COALESCE(target_volume_m3, 0))::numeric, 2) AS target_volume_m3
FROM v_rw_sales_targets_monthly_by_dam
GROUP BY dam_id, dam_name, service_centre_id, year, CEIL(month / 3.0)::int;

-- Quarterly by SC
CREATE OR REPLACE VIEW v_rw_sales_targets_quarterly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  CEIL(month / 3.0)::int AS quarter,
  MAX(dam_count) AS dam_count,
  ROUND(SUM(COALESCE(total_target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM v_rw_sales_targets_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year, CEIL(month / 3.0)::int;

-- Yearly by dam
CREATE OR REPLACE VIEW v_rw_sales_targets_yearly_by_dam AS
SELECT
  dam_id,
  dam_name,
  service_centre_id,
  year,
  ROUND(SUM(COALESCE(target_volume_m3, 0))::numeric, 2) AS target_volume_m3
FROM v_rw_sales_targets_monthly_by_dam
GROUP BY dam_id, dam_name, service_centre_id, year;

-- Yearly by SC
CREATE OR REPLACE VIEW v_rw_sales_targets_yearly_by_sc AS
SELECT
  service_centre_id,
  service_centre_name,
  year,
  MAX(dam_count) AS dam_count,
  ROUND(SUM(COALESCE(total_target_volume_m3, 0))::numeric, 2) AS total_target_volume_m3
FROM v_rw_sales_targets_monthly_by_sc
GROUP BY service_centre_id, service_centre_name, year;


-- ============================================================
-- COMBINED: ACTUAL VS TARGET (monthly, per-station/dam)
-- These join actual sales with targets and compute variance
-- ============================================================

-- CW Sales vs Target (monthly per station)
CREATE OR REPLACE VIEW v_cw_sales_vs_target_monthly AS
SELECT
  COALESCE(a.station_id, t.station_id) AS station_id,
  COALESCE(a.station_name, t.station_name) AS station_name,
  COALESCE(a.station_type, t.station_type) AS station_type,
  COALESCE(a.service_centre_id, t.service_centre_id) AS service_centre_id,
  COALESCE(a.year, t.year) AS year,
  COALESCE(a.month, t.month) AS month,
  COALESCE(a.effective_sales_volume_m3, 0) AS actual_volume_m3,
  COALESCE(t.target_volume_m3, 0) AS target_volume_m3,
  ROUND((COALESCE(a.effective_sales_volume_m3, 0) - COALESCE(t.target_volume_m3, 0))::numeric, 2) AS variance_m3,
  CASE
    WHEN COALESCE(t.target_volume_m3, 0) > 0
    THEN ROUND(((COALESCE(a.effective_sales_volume_m3, 0) / t.target_volume_m3) * 100)::numeric, 1)
    ELSE NULL
  END AS achievement_pct
FROM v_cw_sales_monthly_by_station a
FULL OUTER JOIN v_cw_sales_targets_monthly_by_station t
  ON a.station_id = t.station_id AND a.year = t.year AND a.month = t.month;

-- RW Sales vs Target (monthly per dam)
CREATE OR REPLACE VIEW v_rw_sales_vs_target_monthly AS
SELECT
  COALESCE(a.dam_id, t.dam_id) AS dam_id,
  COALESCE(a.dam_name, t.dam_name) AS dam_name,
  COALESCE(a.service_centre_id, t.service_centre_id) AS service_centre_id,
  COALESCE(a.year, t.year) AS year,
  COALESCE(a.month, t.month) AS month,
  COALESCE(a.sales_volume_m3, 0) AS actual_volume_m3,
  COALESCE(t.target_volume_m3, 0) AS target_volume_m3,
  ROUND((COALESCE(a.sales_volume_m3, 0) - COALESCE(t.target_volume_m3, 0))::numeric, 2) AS variance_m3,
  CASE
    WHEN COALESCE(t.target_volume_m3, 0) > 0
    THEN ROUND(((COALESCE(a.sales_volume_m3, 0) / t.target_volume_m3) * 100)::numeric, 1)
    ELSE NULL
  END AS achievement_pct
FROM v_rw_sales_monthly_by_dam a
FULL OUTER JOIN v_rw_sales_targets_monthly_by_dam t
  ON a.dam_id = t.dam_id AND a.year = t.year AND a.month = t.month;
