-- ============================================
-- ACTUALIZAR PERMISOS DEL ROL ADMINISTRADOR
-- ============================================
-- Este script elimina el acceso del administrador a:
-- - app-settings (Configuración)
-- - tables (Mesas)
-- Solo el Super Administrador tendrá acceso a todo el menú Sistema

-- Eliminar permiso de app-settings para el rol admin
DELETE FROM role_permissions
WHERE role = 'admin'
AND page_id = 'app-settings';

-- Eliminar permiso de tables para el rol admin
DELETE FROM role_permissions
WHERE role = 'admin'
AND page_id = 'tables';

-- Verificar los permisos restantes del admin
SELECT * FROM role_permissions
WHERE role = 'admin'
ORDER BY section, page_id;
