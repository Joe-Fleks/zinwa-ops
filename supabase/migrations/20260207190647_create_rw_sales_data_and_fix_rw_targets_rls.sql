/*
  # Create RW Sales Data table and fix RW Sales Targets policies

  1. New Tables
    - `rw_sales_data` - Monthly raw water sales data per dam
      - `id` (uuid, primary key)
      - `dam_id` (uuid, FK to dams, not null)
      - `year` (integer, not null)
      - `jan` through `dec` (numeric, default 0, must be >= 0)
      - `service_centre_id` (uuid, FK to service_centres)
      - Unique constraint on (dam_id, year)

  2. Security Changes
    - Drop overly permissive INSERT/UPDATE/DELETE policies on `rw_sales_targets`
    - Replace with scope-aware policies on `rw_sales_targets`
    - Enable RLS on `rw_sales_data`
    - Add scope-aware CRUD policies for `rw_sales_data`

  3. Indexes
    - Index on dam_id for joins
    - Index on service_centre_id for scope filtering
*/

-- ============================================================
-- 1. Create RW Sales Data table
-- ============================================================

CREATE TABLE IF NOT EXISTS rw_sales_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id uuid NOT NULL REFERENCES dams(id) ON DELETE CASCADE,
  year integer NOT NULL,
  jan numeric DEFAULT 0 CHECK (jan >= 0),
  feb numeric DEFAULT 0 CHECK (feb >= 0),
  mar numeric DEFAULT 0 CHECK (mar >= 0),
  apr numeric DEFAULT 0 CHECK (apr >= 0),
  may numeric DEFAULT 0 CHECK (may >= 0),
  jun numeric DEFAULT 0 CHECK (jun >= 0),
  jul numeric DEFAULT 0 CHECK (jul >= 0),
  aug numeric DEFAULT 0 CHECK (aug >= 0),
  sep numeric DEFAULT 0 CHECK (sep >= 0),
  oct numeric DEFAULT 0 CHECK (oct >= 0),
  nov numeric DEFAULT 0 CHECK (nov >= 0),
  dec numeric DEFAULT 0 CHECK (dec >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  service_centre_id uuid REFERENCES service_centres(id) ON DELETE RESTRICT,
  UNIQUE(dam_id, year)
);

CREATE INDEX IF NOT EXISTS idx_rw_sales_data_dam ON rw_sales_data(dam_id);
CREATE INDEX IF NOT EXISTS idx_rw_sales_data_sc ON rw_sales_data(service_centre_id);
CREATE INDEX IF NOT EXISTS idx_rw_sales_data_year ON rw_sales_data(year);

ALTER TABLE rw_sales_data ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RLS for rw_sales_data (scope-aware)
-- ============================================================

CREATE POLICY "Users can view RW sales data by scope"
  ON rw_sales_data FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND ur.scope_type = 'NATIONAL'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
      )
      AND dam_id IN (
        SELECT d.id FROM dams d
        JOIN user_roles ur ON d.service_centre_id = ur.scope_id::uuid
        WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
          AND ur.scope_type = 'SC'
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
      )
      AND dam_id IN (
        SELECT d.id FROM dams d
        JOIN service_centres sc ON d.service_centre_id = sc.id
        JOIN user_roles ur ON sc.catchment_id = ur.scope_id::uuid
        WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
          AND ur.scope_type = 'CATCHMENT'
      )
    )
  );

CREATE POLICY "Users can insert RW sales data for their scope"
  ON rw_sales_data FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );

CREATE POLICY "Users can update RW sales data for their scope"
  ON rw_sales_data FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );

CREATE POLICY "Users can delete RW sales data for their scope"
  ON rw_sales_data FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );

-- ============================================================
-- 3. Fix RW Sales Targets RLS (replace permissive with scope-aware)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can delete RW sales targets" ON rw_sales_targets;
DROP POLICY IF EXISTS "Authenticated users can insert RW sales targets" ON rw_sales_targets;
DROP POLICY IF EXISTS "Authenticated users can update RW sales targets" ON rw_sales_targets;

CREATE POLICY "Users can insert RW sales targets for their scope"
  ON rw_sales_targets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );

CREATE POLICY "Users can update RW sales targets for their scope"
  ON rw_sales_targets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );

CREATE POLICY "Users can delete RW sales targets for their scope"
  ON rw_sales_targets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.effective_to IS NULL
        AND (
          ur.scope_type = 'NATIONAL'
          OR (ur.scope_type = 'SC' AND EXISTS (
            SELECT 1 FROM dams d WHERE d.id = dam_id AND d.service_centre_id = ur.scope_id::uuid
          ))
          OR (ur.scope_type = 'CATCHMENT' AND EXISTS (
            SELECT 1 FROM dams d
            JOIN service_centres sc ON d.service_centre_id = sc.id
            WHERE d.id = dam_id AND sc.catchment_id = ur.scope_id::uuid
          ))
        )
    )
  );
