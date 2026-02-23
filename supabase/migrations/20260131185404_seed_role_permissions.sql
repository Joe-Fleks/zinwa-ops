/*
  # Seed Role-Permission Assignments

  Assigns permissions to system roles based on governance requirements.
  
  TO / MO / RO / STL:
    - view_sc_dashboard
    - edit_production_data
    - edit_sales_data

  CM:
    - view_sc_dashboard
    - view_catchment_dashboard

  WSSE:
    - view_sc_dashboard
    - view_catchment_dashboard
    - view_national_dashboard

  WSSM:
    - view_sc_dashboard
    - view_catchment_dashboard
    - view_national_dashboard

  Maintenance Manager:
    - view_sc_dashboard
    - view_catchment_dashboard
    - view_national_dashboard
    - manage_maintenance

  Director:
    - view_sc_dashboard
    - view_catchment_dashboard
    - view_national_dashboard
    - view_advanced_metrics

  CEO:
    - view_sc_dashboard
    - view_catchment_dashboard
    - view_national_dashboard
    - view_advanced_metrics

  Admin:
    - ALL permissions
*/

DO $$
DECLARE
  v_to_id uuid;
  v_mo_id uuid;
  v_ro_id uuid;
  v_stl_id uuid;
  v_cm_id uuid;
  v_wsse_id uuid;
  v_wssm_id uuid;
  v_mm_id uuid;
  v_director_id uuid;
  v_ceo_id uuid;
  v_admin_id uuid;
  v_perms record;
BEGIN

  -- Get role IDs
  SELECT id INTO v_to_id FROM roles WHERE name = 'TO';
  SELECT id INTO v_mo_id FROM roles WHERE name = 'MO';
  SELECT id INTO v_ro_id FROM roles WHERE name = 'RO';
  SELECT id INTO v_stl_id FROM roles WHERE name = 'STL';
  SELECT id INTO v_cm_id FROM roles WHERE name = 'CM';
  SELECT id INTO v_wsse_id FROM roles WHERE name = 'WSSE';
  SELECT id INTO v_wssm_id FROM roles WHERE name = 'WSSM';
  SELECT id INTO v_mm_id FROM roles WHERE name = 'Maintenance Manager';
  SELECT id INTO v_director_id FROM roles WHERE name = 'Director';
  SELECT id INTO v_ceo_id FROM roles WHERE name = 'CEO';
  SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin';

  -- TO / MO / RO / STL permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'edit_production_data', 'edit_sales_data')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_to_id, v_perms.id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_mo_id, v_perms.id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_ro_id, v_perms.id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_stl_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- CM permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_cm_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- WSSE permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard', 'view_national_dashboard')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_wsse_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- WSSM permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard', 'view_national_dashboard')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_wssm_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Maintenance Manager permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard', 'view_national_dashboard', 'manage_maintenance')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_mm_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Director permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard', 'view_national_dashboard', 'view_advanced_metrics')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_director_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- CEO permissions
  FOR v_perms IN
    SELECT id FROM permissions WHERE permission_key IN ('view_sc_dashboard', 'view_catchment_dashboard', 'view_national_dashboard', 'view_advanced_metrics')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_ceo_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Admin gets ALL permissions
  FOR v_perms IN
    SELECT id FROM permissions
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_id, v_perms.id) ON CONFLICT DO NOTHING;
  END LOOP;

END $$;
