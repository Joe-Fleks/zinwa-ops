/*
  # Update Tariffs Table with Category Column & Seed Official ZINWA Tariffs (June 2023)

  ## Summary
  This migration restructures the tariffs table to support per-category Clear Water tariff
  bands and updates the Raw Water tariffs to match the official ZINWA schedule effective
  June 1, 2023.

  ## Changes

  ### 1. Add `category` Column to `tariffs`
  - Nullable text column used only for CW tariffs to differentiate per-category bands
  - RW tariffs leave `category` as NULL (flat rate per category, no bands)
  - CW categories: Domestic, Government, Parastatal, Business, Industry, Institutions, Mines

  ### 2. Clear Old Seeded Data
  - Removes all previously seeded CW and RW tariff bands

  ### 3. Seed Official CW Tariff Bands (per category, USD/m³)
  - Domestic: 6 bands (1–10, 11–20, 21–30, 31–40, 41–50, >50)
  - Government: 6 bands (same band structure as Domestic but different rates)
  - Parastatal: 6 bands (same as Government)
  - Business: 4 bands (1–25, 26–50, 51–100, >100)
  - Industry: flat rate USD 2.77
  - Institutions (Schools & Churches): 4 bands (same structure as Business, lower top rate)
  - Mines: flat rate USD 2.77

  ### 4. Seed Official RW Tariff Rows (USD/ML = USD per million litres)
  Categories: Industry, Commercial Agriculture Estates, Commercial Agriculture A2,
  A1 Farmers, Local Authorities, Communal, Mines

  ## Notes
  - RW tariffs are stored as USD per m³ (converted from USD/ML by dividing by 1,000,000 then
    multiply by 1000 to get per m³: USD/ML ÷ 1000 = USD/m³)
  - RW: 1 ML = 1,000,000 litres = 1,000 m³, so USD/ML ÷ 1000 = USD/m³
  - band_min_m3 = 0, band_max_m3 = NULL for flat-rate rows
*/

-- 1. Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tariffs' AND column_name = 'category'
  ) THEN
    ALTER TABLE tariffs ADD COLUMN category text;
  END IF;
END $$;

-- 2. Remove all existing seeded tariff data
DELETE FROM tariffs;

-- 3. Seed CW Tariff Bands

-- Domestic (6 bands)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Domestic',   '1 – 10 m³',  1,   10,  1.04, 1),
  ('CW', 'Domestic',   '11 – 20 m³', 11,  20,  1.66, 2),
  ('CW', 'Domestic',   '21 – 30 m³', 21,  30,  1.80, 3),
  ('CW', 'Domestic',   '31 – 40 m³', 31,  40,  1.94, 4),
  ('CW', 'Domestic',   '41 – 50 m³', 41,  50,  2.08, 5),
  ('CW', 'Domestic',   '> 50 m³',    51,  NULL, 2.15, 6);

-- Government (6 bands)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Government', '1 – 10 m³',  1,   10,  1.66, 1),
  ('CW', 'Government', '11 – 20 m³', 11,  20,  1.80, 2),
  ('CW', 'Government', '21 – 30 m³', 21,  30,  1.94, 3),
  ('CW', 'Government', '31 – 40 m³', 31,  40,  2.08, 4),
  ('CW', 'Government', '41 – 50 m³', 41,  50,  2.15, 5),
  ('CW', 'Government', '> 50 m³',    51,  NULL, 2.21, 6);

-- Parastatal (6 bands)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Parastatal', '1 – 10 m³',  1,   10,  1.66, 1),
  ('CW', 'Parastatal', '11 – 20 m³', 11,  20,  1.80, 2),
  ('CW', 'Parastatal', '21 – 30 m³', 21,  30,  1.94, 3),
  ('CW', 'Parastatal', '31 – 40 m³', 31,  40,  2.08, 4),
  ('CW', 'Parastatal', '41 – 50 m³', 41,  50,  2.15, 5),
  ('CW', 'Parastatal', '> 50 m³',    51,  NULL, 2.21, 6);

-- Business (4 bands)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Business',   '1 – 25 m³',   1,   25,  1.52, 1),
  ('CW', 'Business',   '26 – 50 m³',  26,  50,  1.66, 2),
  ('CW', 'Business',   '51 – 100 m³', 51,  100, 2.08, 3),
  ('CW', 'Business',   '> 100 m³',    101, NULL, 2.77, 4);

-- Industry (flat)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Industry',   'Flat Rate',   0,   NULL, 2.77, 1);

-- Institutions / Schools & Churches (4 bands)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Institutions', '1 – 25 m³',   1,   25,  1.52, 1),
  ('CW', 'Institutions', '26 – 50 m³',  26,  50,  1.66, 2),
  ('CW', 'Institutions', '51 – 100 m³', 51,  100, 2.08, 3),
  ('CW', 'Institutions', '> 100 m³',    101, NULL, 2.21, 4);

-- Mines (flat)
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('CW', 'Mines',       'Flat Rate',   0,   NULL, 2.77, 1);

-- 4. Seed RW Tariff Rows (USD/m³ = USD/ML ÷ 1000)
-- Industry:               14.35 / 1000 = 0.01435
-- Comm. Agric. Estates:   10.76 / 1000 = 0.01076
-- Comm. Agric. A2:        14.35 / 1000 = 0.01435
-- A1 Farmers:              2.73 / 1000 = 0.00273
-- Local Authorities:      14.35 / 1000 = 0.01435
-- Communal:                2.15 / 1000 = 0.00215
-- Mines:                  80.00 / 1000 = 0.08000
INSERT INTO tariffs (tariff_type, category, band_label, band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order) VALUES
  ('RW', 'Industry',                      'Flat Rate', 0, NULL, 0.01435, 1),
  ('RW', 'Commercial Agriculture Estates','Flat Rate', 0, NULL, 0.01076, 2),
  ('RW', 'Commercial Agriculture A2',     'Flat Rate', 0, NULL, 0.01435, 3),
  ('RW', 'A1 Farmers',                    'Flat Rate', 0, NULL, 0.00273, 4),
  ('RW', 'Local Authorities',             'Flat Rate', 0, NULL, 0.01435, 5),
  ('RW', 'Communal',                      'Flat Rate', 0, NULL, 0.00215, 6),
  ('RW', 'Mines',                         'Flat Rate', 0, NULL, 0.08000, 7);
