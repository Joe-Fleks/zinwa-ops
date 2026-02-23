/*
  # Assign TO Authority Role to Global Admin User

  1. Action
    - Assign TO (Technical Officer) role to Global Admin user (jmlambo@zinwa.co.zw)
    - Scope: Harare Service Centre
    - Keeps existing Global Admin system role intact
    - Global Admin now has dual power:
      - system_rank 100 (Global Admin): Full system control
      - authority_rank 40 (TO): Technical Officer authority for Harare SC

  2. Preservation
    - Global Admin access to Admin module unaffected
    - National scope access unaffected
    - All existing capabilities intact
*/

INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, effective_from)
VALUES (
  '18e0131e-10f1-404b-933d-63b43ed4c1bc',
  '9a727cc1-5a2e-4319-a0e2-eca772b0cd4d',
  'SC',
  '5c000004-0000-4000-a000-000000000004',
  now()
)
ON CONFLICT DO NOTHING;
