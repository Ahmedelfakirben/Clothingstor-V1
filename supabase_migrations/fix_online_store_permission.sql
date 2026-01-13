-- Enable Online Store access for Super Admin
-- Corrected to use the full unique constraint: (role, section, page_id)
INSERT INTO role_permissions (role, section, page_id, can_access, can_confirm_order, can_validate_order)
VALUES 
  ('super_admin', 'Sistema', 'online-store', true, true, true)
ON CONFLICT (role, section, page_id) 
DO UPDATE SET can_access = true;
