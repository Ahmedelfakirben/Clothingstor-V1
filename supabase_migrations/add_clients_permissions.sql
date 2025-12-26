-- Add permissions for the new Clients pag
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
('super_admin', 'finance', 'clients', true),
('admin', 'finance', 'clients', true),
('cashier', 'finance', 'clients', true)
ON CONFLICT (role, section, page_id) DO UPDATE SET can_access = true;
