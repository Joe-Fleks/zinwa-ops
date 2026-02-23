/*
  # Create CW Clients Monthly Snapshot Table

  1. New Tables
    - `cw_clients_monthly`
      - `id` (uuid, primary key)
      - `station_id` (uuid, FK to stations)
      - `year` (integer)
      - `month` (integer, 1-12)
      - `clients_domestic` (integer, default 0)
      - `clients_school` (integer, default 0)
      - `clients_business` (integer, default 0)
      - `clients_industry` (integer, default 0)
      - `clients_church` (integer, default 0)
      - `clients_parastatal` (integer, default 0)
      - `clients_government` (integer, default 0)
      - `clients_other` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (station_id, year, month)

  2. Purpose
    - Stores monthly snapshots of CW client counts per station per category
    - Computed from station registry base + production log new connections
    - Used by NRW financial loss estimations for accurate category-weighted calculations

  3. Security
    - RLS enabled
    - Authenticated users can read data
    - Authenticated users can insert and update snapshots
*/

CREATE TABLE IF NOT EXISTS cw_clients_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  clients_domestic integer NOT NULL DEFAULT 0,
  clients_school integer NOT NULL DEFAULT 0,
  clients_business integer NOT NULL DEFAULT 0,
  clients_industry integer NOT NULL DEFAULT 0,
  clients_church integer NOT NULL DEFAULT 0,
  clients_parastatal integer NOT NULL DEFAULT 0,
  clients_government integer NOT NULL DEFAULT 0,
  clients_other integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(station_id, year, month)
);

ALTER TABLE cw_clients_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cw client snapshots"
  ON cw_clients_monthly
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = cw_clients_monthly.station_id
    )
  );

CREATE POLICY "Authenticated users can insert cw client snapshots"
  ON cw_clients_monthly
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = cw_clients_monthly.station_id
    )
  );

CREATE POLICY "Authenticated users can update cw client snapshots"
  ON cw_clients_monthly
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = cw_clients_monthly.station_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = cw_clients_monthly.station_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_cw_clients_monthly_station_period
  ON cw_clients_monthly(station_id, year, month);
