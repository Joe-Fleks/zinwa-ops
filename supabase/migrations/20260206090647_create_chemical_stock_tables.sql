/*
  # Create chemical stock tracking tables

  1. New Tables
    - `chemical_stock_balances`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, FK to service_centres)
      - `station_id` (uuid, FK to stations)
      - `chemical_type` (text, one of 'aluminium_sulphate', 'hth', 'activated_carbon')
      - `year` (integer)
      - `month` (integer, 1-12)
      - `opening_balance` (numeric, opening balance for the month in kg)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `chemical_stock_receipts`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, FK to service_centres)
      - `station_id` (uuid, FK to stations)
      - `chemical_type` (text)
      - `year` (integer)
      - `month` (integer, 1-12)
      - `quantity` (numeric, kg received or transferred)
      - `receipt_type` (text, 'receipt' or 'transfer_in' or 'transfer_out')
      - `counterpart_station_id` (uuid, nullable, the other station in a transfer)
      - `receipt_date` (date)
      - `notes` (text)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Scope-based policies for SELECT, INSERT, UPDATE, DELETE

  3. Indexes
    - Composite index on (service_centre_id, station_id, chemical_type, year, month)

  4. Notes
    - chemical_type values: 'aluminium_sulphate', 'hth', 'activated_carbon'
    - Opening balance is carried forward from previous month's closing balance
    - Used chemicals are dynamically aggregated from production_logs table
    - Current balance = opening_balance + received - used
*/

CREATE TABLE IF NOT EXISTS chemical_stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  station_id uuid NOT NULL REFERENCES stations(id),
  chemical_type text NOT NULL CHECK (chemical_type IN ('aluminium_sulphate', 'hth', 'activated_carbon')),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  opening_balance numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (station_id, chemical_type, year, month)
);

ALTER TABLE chemical_stock_balances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chemical_stock_balances_lookup
  ON chemical_stock_balances (service_centre_id, chemical_type, year, month);

CREATE POLICY "Authenticated users can view chemical stock balances"
  ON chemical_stock_balances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_balances.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_balances.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can insert chemical stock balances"
  ON chemical_stock_balances FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_balances.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_balances.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can update chemical stock balances"
  ON chemical_stock_balances FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_balances.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_balances.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_balances.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_balances.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can delete chemical stock balances"
  ON chemical_stock_balances FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_balances.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_balances.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE TABLE IF NOT EXISTS chemical_stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  station_id uuid NOT NULL REFERENCES stations(id),
  chemical_type text NOT NULL CHECK (chemical_type IN ('aluminium_sulphate', 'hth', 'activated_carbon')),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  quantity numeric NOT NULL DEFAULT 0,
  receipt_type text NOT NULL DEFAULT 'receipt' CHECK (receipt_type IN ('receipt', 'transfer_in', 'transfer_out')),
  counterpart_station_id uuid REFERENCES stations(id),
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chemical_stock_receipts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chemical_stock_receipts_lookup
  ON chemical_stock_receipts (service_centre_id, chemical_type, year, month);

CREATE INDEX IF NOT EXISTS idx_chemical_stock_receipts_station
  ON chemical_stock_receipts (station_id, chemical_type, year, month);

CREATE POLICY "Authenticated users can view chemical stock receipts"
  ON chemical_stock_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_receipts.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_receipts.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can insert chemical stock receipts"
  ON chemical_stock_receipts FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_receipts.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_receipts.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can update chemical stock receipts"
  ON chemical_stock_receipts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_receipts.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_receipts.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_receipts.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_receipts.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

CREATE POLICY "Authenticated users can delete chemical stock receipts"
  ON chemical_stock_receipts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = chemical_stock_receipts.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = chemical_stock_receipts.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );
