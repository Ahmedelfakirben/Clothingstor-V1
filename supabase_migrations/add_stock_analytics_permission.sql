-- Add stock-analytics permission for super_admin and admin

INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES 
  ('super_admin', 'Finanzas', 'stock-analytics', true),
  ('admin', 'Finanzas', 'stock-analytics', true)
ON CONFLICT (role, section, page_id) DO NOTHING;
