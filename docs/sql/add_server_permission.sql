-- Add 'server' permission to role_permissions table
-- This script can be run multiple times safely (idempotent)

-- Add server page permission for super_admin role
INSERT INTO role_permissions (role, page_id, can_access)
VALUES ('super_admin', 'server', true)
ON CONFLICT (role, page_id)
DO UPDATE SET can_access = true;

-- Ensure other roles do not have access to server page
INSERT INTO role_permissions (role, page_id, can_access)
VALUES
  ('admin', 'server', false),
  ('cashier', 'server', false),
  ('waiter', 'server', false),
  ('barista', 'server', false)
ON CONFLICT (role, page_id)
DO UPDATE SET can_access = false;

-- Verify the changes
SELECT role, page_id, can_access
FROM role_permissions
WHERE page_id = 'server'
ORDER BY role;
