# Módulo de Gestión del Servidor - Server Manager

## ✅ Implementación Completada

Se ha implementado un módulo completo de administración del servidor para el Super Administrador.

## 📋 Características

### 1. **Estado del Servidor**
- ✅ Verificar estado de conexión con Supabase
- ✅ Medición de latencia en tiempo real
- ✅ Última verificación con timestamp

### 2. **Backup y Restauración**
- ✅ **Exportar Backup** - Descarga toda la base de datos en formato JSON
- ✅ **Importar Backup** - Restaura la base de datos desde un archivo JSON
- ✅ Incluye todas las tablas del sistema
- ✅ Formato de fecha en el nombre del archivo

### 3. **Limpieza de Base de Datos**
- ✅ Elimina TODO el historial de datos
- ✅ **PRESERVA usuarios Super Admin** (nunca se eliminan)
- ✅ Preserva configuración de la empresa
- ✅ Preserva categorías, proveedores y permisos de roles
- ✅ Doble confirmación para evitar eliminaciones accidentales

### 4. **Seguridad**
- ✅ Solo accesible para usuarios con rol `super_admin`
- ✅ Protección a nivel de interfaz
- ✅ Protección a nivel de base de datos (RLS)
- ✅ Advertencias claras sobre operaciones peligrosas

## 🚀 Pasos para Activar el Módulo

### Paso 1: Ejecutar el Script SQL

**IMPORTANTE:** Debes ejecutar este script SQL en tu base de datos de Supabase:

```sql
-- Archivo: add_server_permission_v3.sql

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
```

**Cómo ejecutar:**
1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `add_server_permission_v3.sql`
4. Haz clic en **Run**

### Paso 2: Verificar la Instalación

Después de ejecutar el SQL:

1. Inicia sesión como **Super Administrador**
2. Ve a **Sistema > Servidor**
3. Deberías ver la interfaz de gestión del servidor con 3 secciones:
   - **Estado del Servidor**
   - **Backup y Restauración**
   - **Limpieza de Base de Datos**

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:
1. **`src/components/ServerManager.tsx`** - Componente principal de gestión del servidor (498 líneas)
2. **`add_server_permission.sql`** - Script SQL inicial (con ON CONFLICT - ❌ no funciona)
3. **`add_server_permission_v2.sql`** - Script SQL v2 (sin section - ❌ no funciona)
4. **`add_server_permission_v3.sql`** - Script SQL v3 (con section='Sistema' - ✅ usar este)
5. **`SERVIDOR_README.md`** - Esta documentación

### Archivos Modificados:
1. **`src/App.tsx`** - Agregado import y routing de ServerManager
2. **`src/components/Navigation.tsx`** - Agregado ítem "Servidor" en menú Sistema
3. **`src/contexts/LanguageContext.tsx`** - Agregadas traducciones en Español y Francés

## 🎯 Funcionalidades Detalladas

### 1. Verificar Estado del Servidor

**¿Qué hace?**
- Mide la conexión con Supabase
- Calcula la latencia en milisegundos
- Muestra si el servidor está online u offline

**Cómo usar:**
1. Haz clic en **"Verificar Estado"**
2. Espera unos segundos
3. Verás un indicador verde (online) o rojo (offline)
4. Se muestra la latencia y la hora de verificación

### 2. Exportar Backup

**¿Qué hace?**
- Descarga TODA la base de datos en un archivo JSON
- Incluye todas las tablas del sistema
- Formato: `backup-YYYY-MM-DD.json`

**Tablas incluidas:**
- `company_settings` - Configuración de la empresa
- `employee_profiles` - Perfiles de empleados
- `products` - Productos
- `categories` - Categorías
- `tables` - Mesas
- `orders` - Órdenes/Pedidos
- `order_items` - Items de órdenes
- `cash_register_sessions` - Sesiones de caja
- `cash_withdrawals` - Retiros de caja
- `suppliers` - Proveedores
- `expenses` - Gastos
- `role_permissions` - Permisos de roles

**Cómo usar:**
1. Haz clic en **"Exportar Backup"**
2. Espera a que se descargue el archivo JSON
3. Guarda el archivo en un lugar seguro
4. Este archivo puede usarse para restaurar la base de datos

**⚠️ Recomendación:** Exporta un backup antes de hacer cambios importantes o limpiar la base de datos.

### 3. Importar Backup

**¿Qué hace?**
- Restaura la base de datos desde un archivo JSON exportado previamente
- Sobrescribe los datos existentes
- Preserva usuarios super_admin

**Cómo usar:**
1. Haz clic en **"Seleccionar archivo"** o arrastra un archivo JSON
2. Confirma que deseas importar (doble confirmación)
3. Espera a que se complete la importación
4. La aplicación se recargará automáticamente

**⚠️ ADVERTENCIA:** Esta operación sobrescribirá los datos actuales. Asegúrate de tener un backup actual antes de importar.

### 4. Limpiar Base de Datos

**¿Qué hace?**
- Elimina TODO el historial de datos
- Preserva:
  - ✅ Usuarios Super Administrador
  - ✅ Configuración de la empresa
  - ✅ Categorías de productos
  - ✅ Proveedores
  - ✅ Permisos de roles

- Elimina:
  - ❌ Todos los pedidos (orders)
  - ❌ Items de pedidos (order_items)
  - ❌ Sesiones de caja (cash_register_sessions)
  - ❌ Retiros de caja (cash_withdrawals)
  - ❌ Empleados que no sean super_admin
  - ❌ Productos
  - ❌ Mesas
  - ❌ Gastos

**Cómo usar:**
1. **⚠️ EXPORTA UN BACKUP PRIMERO** (muy recomendado)
2. Haz clic en **"Limpiar Base de Datos"**
3. Lee y confirma la primera advertencia
4. Lee y confirma la segunda advertencia
5. Espera a que se complete la limpieza
6. La aplicación se recargará automáticamente

**⚠️ ADVERTENCIA:** Esta acción es IRREVERSIBLE. Una vez ejecutada, no podrás recuperar los datos eliminados sin un backup.

**Cuándo usar esta función:**
- Al finalizar un período de pruebas
- Al comenzar una nueva temporada/año
- Para limpiar datos de demostración
- Al resetear el sistema a estado inicial

## 🛡️ Seguridad

### Restricciones de Acceso

1. **Nivel de Interfaz (UI):**
   - Solo usuarios con `role = 'super_admin'` ven el menú "Servidor"
   - Otros usuarios no tienen acceso visual al módulo

2. **Nivel de Componente:**
   - Si un usuario no super_admin intenta acceder directamente
   - Se muestra un mensaje de "Acceso Denegado"

3. **Nivel de Base de Datos:**
   - RLS (Row Level Security) de Supabase protege las operaciones
   - Solo super_admin puede modificar datos críticos

### Advertencias y Confirmaciones

- **Importar:** 1 confirmación (sobrescribirá datos)
- **Limpiar:** 2 confirmaciones (acción irreversible)
- **Exportar:** Sin confirmación (solo lectura)
- **Estado:** Sin confirmación (solo lectura)

## 📊 Estructura del Backup JSON

Ejemplo de estructura del archivo de backup:

```json
{
  "timestamp": "2024-12-14T10:30:45.123Z",
  "version": "1.0",
  "tables": {
    "company_settings": [...],
    "employee_profiles": [...],
    "products": [...],
    "categories": [...],
    "tables": [...],
    "orders": [...],
    "order_items": [...],
    "cash_register_sessions": [...],
    "cash_withdrawals": [...],
    "suppliers": [...],
    "expenses": [...],
    "role_permissions": [...]
  }
}
```

## 🔧 Traducciones

El módulo está completamente traducido a:
- 🇪🇸 **Español** (idioma principal)
- 🇫🇷 **Francés** (idioma secundario)

Todas las traducciones se encuentran en `src/contexts/LanguageContext.tsx` bajo la sección "// Gestión del Servidor"

## ⚠️ Notas Importantes

1. **Ejecuta el SQL primero**: Sin ejecutar `add_server_permission_v2.sql`, el módulo no será accesible
2. **Solo super_admin**: Este módulo es SOLO para super administradores
3. **Backups regulares**: Se recomienda exportar backups regularmente (diario, semanal, mensual)
4. **Prueba en desarrollo**: Antes de usar en producción, prueba todas las funciones en un ambiente de desarrollo
5. **Latencia del servidor**: La latencia depende de tu ubicación y la región de Supabase
6. **Tamaño del backup**: Archivos JSON pueden ser grandes si tienes muchos datos

## 🐛 Solución de Problemas

### El menú "Servidor" no aparece
- **Causa**: No estás logueado como super_admin o no ejecutaste el SQL
- **Solución**: Verifica tu rol en la base de datos y ejecuta `add_server_permission_v2.sql`

### Error al exportar backup
- **Causa**: Problema de conexión con Supabase o permisos RLS
- **Solución**: Verifica tu conexión a internet y permisos de la tabla

### Error al importar backup
- **Causa**: Archivo JSON inválido o formato incorrecto
- **Solución**: Usa solo archivos JSON exportados por este sistema

### Error al limpiar base de datos
- **Causa**: Restricciones de foreign keys o permisos RLS
- **Solución**: Verifica que no haya restricciones bloqueando la eliminación

### El servidor aparece "Fuera de Línea"
- **Causa**: Sin conexión a internet o Supabase caído
- **Solución**: Verifica tu conexión y estado de Supabase

## 📞 Soporte

Si encuentras algún problema:
1. Verifica que ejecutaste el script SQL
2. Revisa la consola del navegador (F12) para errores
3. Verifica que el usuario sea super_admin
4. Comprueba que el permiso 'server' existe en `role_permissions`

## 📈 Mejoras Futuras

Posibles mejoras a implementar:
- [ ] Programación automática de backups
- [ ] Backups incrementales (solo cambios)
- [ ] Compresión de archivos JSON (.zip)
- [ ] Subida automática a almacenamiento externo (S3, etc.)
- [ ] Logs de todas las operaciones realizadas
- [ ] Estadísticas de uso del servidor
- [ ] Monitoreo de espacio en disco
- [ ] Alertas por email cuando el servidor está offline

## ✨ Conclusión

El módulo de Gestión del Servidor está completamente funcional y listo para usar. Proporciona herramientas poderosas para administrar la base de datos, realizar backups y mantener el sistema limpio. Úsalo con precaución y siempre mantén backups actualizados.
