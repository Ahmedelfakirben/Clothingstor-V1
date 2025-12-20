-- Add 'server' permission to role_permissions table
-- This script can be run multiple times safely (idempotent)

-- First, delete any existing 'server' permissions to avoid duplicates
DELETE FROM role_permissions WHERE page_id = 'server';

-- Add server page permission for super_admin role (can access)
INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES ('super_admin', 'Sistema', 'server', true);

-- Ensure other roles do not have access to server page
INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES
  ('admin', 'Sistema', 'server', false),
  ('cashier', 'Sistema', 'server', false),
  ('waiter', 'Sistema', 'server', false),
  ('barista', 'Sistema', 'server', false);

-- Verify the changes
SELECT role, section, page_id, can_access
FROM role_permissions
WHERE page_id = 'server'
ORDER BY role;
