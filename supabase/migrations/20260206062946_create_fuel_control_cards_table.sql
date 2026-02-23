/*
  # Create fuel control cards table

  1. New Tables
    - `fuel_control_cards`
      - `id` (uuid, primary key)
      - `service_centre_id` (uuid, foreign key to service_centres)
      - `fuel_type` (text, 'diesel' or 'petrol')
      - `entry_date` (date, the date of the transaction)
      - `voucher_no` (text, optional voucher number)
      - `no_plate` (text, optional vehicle plate number)
      - `issues` (numeric, litres issued)
      - `receipts` (numeric, litres received)
      - `balance` (numeric, running balance after transaction)
      - `description` (text, purpose/description of transaction)
      - `req_no` (text, optional requisition number)
      - `collected_by` (text, name of person who collected fuel)
      - `is_opening_balance` (boolean, marks the carry-forward row)
      - `year` (integer, for filtering)
      - `month` (integer, 1-12 for filtering)
      - `sort_order` (integer, ordering within a month)
      - `created_by` (uuid, user who created the entry)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `fuel_control_cards` table
    - Add policies for authenticated users scoped to their service centre

  3. Indexes
    - Composite index on (service_centre_id, fuel_type, year, month) for fast filtering
*/

CREATE TABLE IF NOT EXISTS fuel_control_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_centre_id uuid NOT NULL REFERENCES service_centres(id),
  fuel_type text NOT NULL CHECK (fuel_type IN ('diesel', 'petrol')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  voucher_no text DEFAULT '',
  no_plate text DEFAULT '',
  issues numeric DEFAULT 0,
  receipts numeric DEFAULT 0,
  balance numeric DEFAULT 0,
  description text DEFAULT '',
  req_no text DEFAULT '',
  collected_by text DEFAULT '',
  is_opening_balance boolean DEFAULT false,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  month integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_control_cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fuel_control_cards_lookup
  ON fuel_control_cards (service_centre_id, fuel_type, year, month);

CREATE INDEX IF NOT EXISTS idx_fuel_control_cards_sort
  ON fuel_control_cards (service_centre_id, fuel_type, year, month, sort_order);

-- Authenticated users can view fuel control cards for service centres they have access to
CREATE POLICY "Authenticated users can view fuel control cards"
  ON fuel_control_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = fuel_control_cards.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = fuel_control_cards.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

-- Authenticated users can insert fuel control cards for their service centre
CREATE POLICY "Authenticated users can insert fuel control cards"
  ON fuel_control_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = fuel_control_cards.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = fuel_control_cards.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

-- Authenticated users can update fuel control cards for their service centre
CREATE POLICY "Authenticated users can update fuel control cards"
  ON fuel_control_cards
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = fuel_control_cards.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = fuel_control_cards.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = fuel_control_cards.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = fuel_control_cards.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );

-- Authenticated users can delete fuel control cards for their service centre
CREATE POLICY "Authenticated users can delete fuel control cards"
  ON fuel_control_cards
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.effective_to IS NULL
      AND (
        (ur.scope_type = 'SC' AND ur.scope_id = fuel_control_cards.service_centre_id)
        OR (ur.scope_type = 'CATCHMENT' AND ur.scope_id IN (
          SELECT sc.catchment_id FROM service_centres sc WHERE sc.id = fuel_control_cards.service_centre_id
        ))
        OR ur.scope_type = 'NATIONAL'
      )
    )
  );
