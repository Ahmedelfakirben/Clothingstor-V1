# Instalación del Sistema de Backup

## Resumen de la Implementación

Se ha implementado un sistema completo de backup para tu aplicación LIN-Caisse. El sistema permite al Super Administrador crear copias de seguridad de la base de datos de Supabase y descargarlas en formato JSON.

## Archivos Creados/Modificados

### Archivos Nuevos:
1. **`src/components/BackupManager.tsx`** - Componente principal de gestión de backups
2. **`SISTEMA_BACKUP_README.md`** - Documentación completa del sistema
3. **`supabase/migrations/backup_system_setup.sql`** - Script SQL para configuración
4. **`INSTALACION_BACKUP.md`** - Este archivo de instalación

### Archivos Modificados:
1. **`src/App.tsx`** - Agregada ruta para BackupManager
2. **`src/components/Navigation.tsx`** - Agregado menú de Backup
3. **`src/contexts/LanguageContext.tsx`** - Agregadas traducciones

## Pasos de Instalación

### 1. Ejecutar Script SQL en Supabase

Necesitas ejecutar el script SQL para configurar los permisos y la tabla de historial:

**OPCIÓN A - Script Simplificado (Recomendado):**
1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva consulta
4. Copia y pega el contenido de `supabase/migrations/backup_simple.sql`
5. Ejecuta el script (botón "Run")

**OPCIÓN B - Script Completo:**
1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva consulta
4. Copia y pega el contenido de `supabase/migrations/backup_system_setup.sql`
5. Ejecuta el script (botón "Run")

El script hará lo siguiente:
- ✅ Agregar permiso `backup` para el rol `super_admin` en `role_permissions`
- ✅ Crear la tabla `backup_history` (opcional pero recomendado)
- ✅ Configurar políticas RLS para seguridad
- ✅ Crear índices para mejorar rendimiento
- ✅ Crear función de limpieza de historial antiguo

### 2. Verificar la Instalación

Después de ejecutar el script SQL, verifica que todo esté correcto:

```sql
-- Verificar permiso de backup
SELECT * FROM role_permissions WHERE page_id = 'backup';

-- Verificar tabla de historial
SELECT * FROM backup_history LIMIT 1;
```

Deberías ver:
- Un registro en `role_permissions` con `role='super_admin'` y `page_id='backup'`
- La tabla `backup_history` creada (puede estar vacía)

### 3. Desplegar en Coolify

Si estás usando Coolify para deployment:

1. **Hacer commit de los cambios**:
```bash
git add .
git commit -m "Implementar sistema de backup completo"
git push
```

2. **Coolify desplegará automáticamente** los cambios (si tienes auto-deploy habilitado)

   O manualmente:
   - Ve a tu proyecto en Coolify
   - Haz clic en "Redeploy"

3. **Espera a que se complete el build** y deployment

### 4. Probar el Sistema

1. **Inicia sesión como Super Admin**
2. **Ve al menú Sistema → Backup**
3. **Selecciona las tablas** que deseas incluir en el backup
4. **Haz clic en "Descargar Backup Ahora"**
5. **Verifica que se descargue** el archivo JSON

### 5. Verificar el Archivo de Backup

Abre el archivo JSON descargado y verifica que contenga:
```json
{
  "timestamp": "...",
  "version": "1.0",
  "metadata": {...},
  "tables": {
    "products": [...],
    "categories": [...],
    ...
  }
}
```

## Funcionalidades Implementadas

### ✅ Backup Manual
- Selección de tablas a exportar
- Botones de atajo (Todas/Esenciales/Ninguna)
- Descarga directa en formato JSON
- Información de tamaño del backup

### ✅ Historial de Backups
- Registro de todos los backups creados
- Fecha, tamaño, tablas incluidas
- Estado (Completado/Fallido)
- Últimos 10 backups mostrados

### ✅ Seguridad
- Solo accesible por Super Administrador
- Políticas RLS en Supabase
- Validación de permisos en frontend y backend

### ✅ Interfaz de Usuario
- Diseño responsive
- Indicadores visuales claros
- Mensajes de confirmación
- Traducciones en Español y Francés

## Tablas Incluidas en el Backup

### Tablas Esenciales (Recomendadas):
- ✅ products
- ✅ categories
- ✅ orders
- ✅ order_items
- ✅ employee_profiles
- ✅ cash_register_sessions
- ✅ role_permissions
- ✅ company_settings
- ✅ app_settings
- ✅ tables

### Tablas Opcionales:
- customers
- suppliers
- expenses
- employee_time_entries
- servers

## Uso Recomendado

### Frecuencia de Backups
1. **Diario**: Para operaciones normales
2. **Antes de actualizaciones**: Siempre antes de cambios importantes
3. **Antes de modificaciones masivas**: Antes de cambios en datos

### Almacenamiento
1. **Local**: Guarda en tu computadora
2. **Nube**: Sube a Google Drive, Dropbox, OneDrive, etc.
3. **Múltiples copias**: Mantén al menos 3 copias recientes
4. **Rotación**: Mantén backups de los últimos 30 días

## Troubleshooting

### Problema: Error "column page_name does not exist"
**Solución**:
- Usa el script `backup_simple.sql` en lugar de `backup_system_setup.sql`
- El script simplificado está corregido para la estructura de tu base de datos
- No incluye la columna `page_name` que no existe en tu tabla

### Problema: No veo la opción "Backup" en el menú
**Solución**:
- Verifica que hayas ejecutado el script SQL
- Confirma que estás logueado como `super_admin`
- Revisa la consola del navegador para errores

### Problema: Error al descargar backup
**Solución**:
- Verifica las políticas RLS en Supabase
- Confirma que tienes permisos de lectura en todas las tablas
- Revisa los logs del navegador (F12 → Console)

### Problema: El historial no se muestra
**Solución**:
- Esto es normal si no ejecutaste la parte de `backup_history`
- El historial es opcional, el backup funcionará sin él
- Si quieres historial, ejecuta la parte correspondiente del SQL

### Problema: Archivo de backup muy grande
**Solución**:
- Selecciona solo las tablas esenciales
- Considera hacer backups por categorías (solo productos, solo órdenes, etc.)
- Los archivos grandes (>50MB) pueden tardar en descargarse

## Próximos Pasos Opcionales

Si quieres mejorar aún más el sistema de backup:

### 1. Backups Automáticos Programados
Puedes configurar un cron job o usar Supabase Edge Functions para crear backups automáticos diarios.

### 2. Almacenamiento en la Nube
Integrar con Supabase Storage o AWS S3 para guardar backups automáticamente.

### 3. Restauración desde la Interfaz
Implementar un sistema de restauración que permita subir y restaurar backups desde la UI.

### 4. Compresión
Agregar compresión gzip para reducir el tamaño de los archivos.

### 5. Backups Incrementales
Solo exportar datos que han cambiado desde el último backup.

## Mantenimiento

### Limpieza de Historial Antiguo

Para mantener la tabla de historial limpia, ejecuta periódicamente:

```sql
-- Eliminar backups con más de 90 días
SELECT cleanup_old_backup_history(90);
```

O programa un cron job en Supabase para hacerlo automáticamente.

### Monitoreo

Revisa regularmente:
- ✅ Tamaño de los backups (debe ser consistente)
- ✅ Frecuencia de creación (al menos semanalmente)
- ✅ Estado de los backups (todos deben ser 'completed')

## Soporte y Documentación

- **Documentación completa**: Ver `SISTEMA_BACKUP_README.md`
- **Script SQL**: Ver `supabase/migrations/backup_system_setup.sql`
- **Componente**: Ver `src/components/BackupManager.tsx`

## Checklist de Instalación

- [ ] Script SQL ejecutado en Supabase
- [ ] Permiso `backup` verificado en `role_permissions`
- [ ] Tabla `backup_history` creada
- [ ] Código desplegado en Coolify
- [ ] Prueba de backup realizada exitosamente
- [ ] Archivo de backup descargado y verificado
- [ ] Backup guardado en ubicación segura

## Contacto

Si tienes problemas con la instalación:
1. Revisa los logs del navegador (F12)
2. Verifica las políticas RLS en Supabase
3. Consulta la documentación completa
4. Revisa los commits en el repositorio

---

**¡Felicidades!** Tu sistema de backup está listo para usar.

Recuerda hacer backups regularmente y guardarlos en múltiples ubicaciones seguras. 🎉
