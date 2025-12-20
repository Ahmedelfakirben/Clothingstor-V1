# Sistema de Backup - LIN-Caisse

## Descripción General

El Sistema de Backup permite a los Super Administradores crear copias de seguridad completas de la base de datos de forma manual. Los backups se descargan como archivos JSON que pueden guardarse de forma segura fuera del servidor.

## Características Principales

### 1. **Backup Manual**
- Exportación completa de datos de Supabase
- Selección flexible de tablas a incluir
- Descarga directa en formato JSON
- Registro del historial de backups

### 2. **Tablas Incluidas**

El sistema permite hacer backup de las siguientes tablas:

#### Tablas Esenciales (Recomendadas):
- `products` - Catálogo de productos
- `categories` - Categorías de productos
- `orders` - Órdenes de clientes
- `order_items` - Items de órdenes
- `employee_profiles` - Perfiles de empleados
- `cash_register_sessions` - Sesiones de caja
- `role_permissions` - Permisos de roles
- `company_settings` - Configuración de empresa
- `app_settings` - Configuración de aplicación
- `tables` - Mesas/Salas

#### Tablas Opcionales:
- `customers` - Clientes
- `suppliers` - Proveedores
- `expenses` - Gastos
- `employee_time_entries` - Registros de tiempo
- `servers` - Servidores

### 3. **Formato de Backup**

Los archivos de backup se generan con el siguiente formato:

```json
{
  "timestamp": "2025-10-25T10:30:00.000Z",
  "version": "1.0",
  "metadata": {
    "created_by": "Nombre del Super Admin",
    "created_at": "2025-10-25T10:30:00.000Z",
    "tables_count": 15
  },
  "tables": {
    "products": [...],
    "categories": [...],
    "orders": [...],
    ...
  }
}
```

### 4. **Nombre de Archivo**

Los backups se descargan con el siguiente formato de nombre:
```
backup-coffe-YYYY-MM-DD-timestamp.json
```

Ejemplo: `backup-coffe-2025-10-25-1729851000000.json`

## Uso del Sistema

### Acceso

1. Inicia sesión como **Super Administrador**
2. Ve al menú **Sistema** → **Backup**

### Crear un Backup Manual

1. **Seleccionar Tablas**:
   - Usa los botones de atajo:
     - **Todas**: Selecciona todas las tablas disponibles
     - **Esenciales**: Selecciona solo las tablas esenciales
     - **Ninguna**: Deselecciona todas las tablas
   - O marca/desmarca tablas individualmente

2. **Iniciar Backup**:
   - Haz clic en "Descargar Backup Ahora"
   - El sistema exportará los datos y descargará el archivo JSON
   - Se mostrará el progreso y confirmación

3. **Guardar el Archivo**:
   - El archivo se descargará automáticamente
   - Guárdalo en un lugar seguro
   - **Recomendación**: Mantén múltiples copias en diferentes ubicaciones

### Historial de Backups

El sistema mantiene un registro de todos los backups creados, mostrando:
- Fecha y hora de creación
- Tipo (Manual/Automático)
- Tamaño del archivo
- Número de tablas incluidas
- Estado (Completado/Fallido)

## Arquitectura Técnica

### Backend (Supabase)

El sistema se conecta directamente a Supabase para extraer datos:

```typescript
// Exportar datos de una tabla
const { data, error } = await supabase
  .from(tableName)
  .select('*');
```

### Frontend (React)

El componente `BackupManager.tsx` maneja:
- Interfaz de usuario
- Selección de tablas
- Exportación de datos
- Descarga de archivos
- Registro de historial

### Tabla de Historial (Opcional)

Si existe la tabla `backup_history` en Supabase, el sistema guardará registros:

```sql
CREATE TABLE backup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  backup_type VARCHAR(20) CHECK (backup_type IN ('manual', 'automatic')),
  size_mb DECIMAL(10,2),
  tables_included TEXT[],
  status VARCHAR(20) CHECK (status IN ('completed', 'failed'))
);
```

## Configuración en Supabase

### Permisos Requeridos

Para usar el sistema de backup, necesitas:

1. **Políticas RLS** que permitan al super_admin leer todas las tablas
2. **Permiso de página** `backup` asignado al rol `super_admin` en `role_permissions`

### Agregar Permiso de Backup

Ejecuta en Supabase SQL Editor:

```sql
-- Insertar permiso de backup para super_admin
INSERT INTO role_permissions (role, page_id, can_access)
VALUES ('super_admin', 'backup', true)
ON CONFLICT (role, page_id) DO UPDATE SET can_access = true;
```

### Crear Tabla de Historial (Opcional)

```sql
-- Crear tabla de historial de backups
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  backup_type VARCHAR(20) CHECK (backup_type IN ('manual', 'automatic')),
  size_mb DECIMAL(10,2),
  tables_included TEXT[],
  status VARCHAR(20) CHECK (status IN ('completed', 'failed'))
);

-- Habilitar RLS
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- Política para super_admin
CREATE POLICY "Super admins can view backup history"
  ON backup_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
    )
  );

-- Política para insertar
CREATE POLICY "Super admins can insert backup history"
  ON backup_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
    )
  );
```

## Buenas Prácticas

### Frecuencia de Backups

1. **Diario**: Para operaciones normales
2. **Antes de actualizaciones**: Siempre antes de cambios importantes
3. **Antes de modificaciones masivas**: Antes de cambios en datos

### Almacenamiento de Backups

1. **Local**: Guarda en tu computadora
2. **Nube**: Sube a Google Drive, Dropbox, etc.
3. **Múltiples copias**: Mantén al menos 3 copias recientes
4. **Rotación**: Mantén backups de los últimos 30 días

### Seguridad

1. **Protege los archivos**: Los backups contienen datos sensibles
2. **Cifrado**: Considera cifrar los archivos de backup
3. **Acceso limitado**: Solo super_admin puede crear backups
4. **Verificación**: Revisa periódicamente que los backups sean válidos

## Restauración de Backups

**IMPORTANTE**: La restauración de backups debe hacerse manualmente en Supabase.

### Proceso de Restauración

1. **Analizar el Backup**:
   - Abre el archivo JSON
   - Verifica que contenga los datos esperados
   - Confirma la fecha y versión

2. **Restaurar en Supabase**:

   **Opción A: Usando SQL (Recomendado)**
   ```sql
   -- Ejemplo para restaurar productos
   INSERT INTO products (id, name, description, base_price, ...)
   SELECT * FROM json_populate_recordset(null::products, '[...]');
   ```

   **Opción B: Usando la API de Supabase**
   ```typescript
   // Leer el archivo de backup
   const backupData = JSON.parse(backupContent);

   // Restaurar cada tabla
   for (const [table, records] of Object.entries(backupData.tables)) {
     await supabase.from(table).insert(records);
   }
   ```

   **Opción C: Manualmente**
   - Usa la interfaz de Supabase
   - Importa tabla por tabla

3. **Verificar**:
   - Confirma que los datos se restauraron correctamente
   - Verifica relaciones entre tablas
   - Prueba la funcionalidad de la aplicación

## Integración con Coolify

Dado que tu aplicación está alojada en **Coolify**, considera:

### Backups Automáticos del Servidor

Coolify puede configurarse para hacer backups automáticos de:
- Volúmenes de Docker
- Variables de entorno
- Configuraciones de la aplicación

### Backup de Supabase

Supabase ofrece backups automáticos en planes pagos:
- **Backups diarios automáticos**
- **Point-in-time recovery**
- **Retención configurable**

**Recomendación**: Combina los backups de Supabase con los backups manuales de este sistema para máxima seguridad.

## Troubleshooting

### El botón de backup está deshabilitado
- Verifica que hayas seleccionado al menos una tabla
- Confirma que eres super_admin

### Error al exportar tabla
- Verifica las políticas RLS en Supabase
- Confirma que la tabla existe
- Revisa los permisos del usuario

### El archivo descargado está vacío
- Verifica que las tablas contengan datos
- Revisa la consola del navegador para errores
- Confirma la conexión con Supabase

### No se muestra el historial
- La tabla `backup_history` es opcional
- Crea la tabla siguiendo las instrucciones anteriores
- Verifica las políticas RLS

## Mantenimiento

### Limpieza de Historial

Ejecuta periódicamente en Supabase:

```sql
-- Eliminar registros de historial antiguos (más de 90 días)
DELETE FROM backup_history
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitoreo

Verifica regularmente:
- Tamaño de los backups (debe ser consistente)
- Frecuencia de creación
- Estado de los backups (todos deben ser 'completed')

## Próximas Mejoras

Posibles mejoras futuras:
1. **Backups automáticos programados**
2. **Restauración desde la interfaz**
3. **Compresión de archivos**
4. **Subida automática a cloud storage**
5. **Backups incrementales**
6. **Verificación automática de integridad**

## Soporte

Para problemas o preguntas:
1. Revisa los logs del navegador (F12)
2. Verifica las políticas RLS en Supabase
3. Consulta la documentación de Supabase
4. Contacta al equipo de desarrollo

---

**Versión del Sistema**: 1.0
**Última Actualización**: Octubre 2025
**Compatibilidad**: Supabase + React + TypeScript
