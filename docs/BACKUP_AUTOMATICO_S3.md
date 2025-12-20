# Sistema de Backup Automático con S3

## Descripción General

Sistema completo de backups automáticos que exporta datos de Supabase y los sube a tu S3 Storage configurado en Coolify. Los backups se ejecutan según una programación configurable y se almacenan de forma segura en la nube.

## Características

✅ **Backups Programados**: Diarios, semanales o mensuales
✅ **Almacenamiento S3**: Integración con tu S3 Storage de Coolify
✅ **Configuración Flexible**: UI completa para administración
✅ **Retención Automática**: Limpieza de backups antiguos
✅ **Historial Completo**: Registro de todos los backups
✅ **Ejecución Manual**: Prueba backups en cualquier momento
✅ **Notificaciones**: Estados y errores registrados

## Arquitectura del Sistema

```
┌─────────────────┐
│   Frontend UI   │ ← Configuración de backups
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Supabase Edge   │ ← Función de backup automático
│   Functions     │
└────────┬────────┘
         │
         ├──→ ┌─────────────────┐
         │    │   Supabase DB   │ ← Exportación de datos
         │    └─────────────────┘
         │
         └──→ ┌─────────────────┐
              │   S3 Storage    │ ← Almacenamiento de backups
              │   (Coolify)     │
              └─────────────────┘
```

## Archivos del Sistema

### Backend
- `supabase/functions/automated-backup/index.ts` - Edge Function principal
- `supabase/functions/cron-backup/index.ts` - Cron job para ejecución programada
- `supabase/migrations/automated_backup_setup.sql` - Configuración de BD

### Frontend
- `src/components/BackupManager.tsx` - UI principal con tabs
- `src/components/AutomatedBackupConfig.tsx` - Configuración de backups automáticos
- `src/lib/s3BackupService.ts` - Servicio de S3 y backups

### Scripts
- `scripts/setup-cron-backup.sh` - Instalación del cron job

## Instalación

### 1. Ejecutar Script SQL

Ejecuta en Supabase SQL Editor:

```bash
# Copia y pega el contenido de:
supabase/migrations/automated_backup_setup.sql
```

Esto creará:
- Tabla `backup_config` con configuración
- Columnas adicionales en `backup_history` para S3
- Políticas RLS de seguridad
- Funciones automáticas de cálculo y limpieza
- Vista de estadísticas

### 2. Configurar Variables de Entorno en Supabase

Ve a tu proyecto en Supabase → Settings → Edge Functions → Secrets

Agrega las siguientes variables:

```env
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_ACCESS_KEY=tu_access_key
S3_SECRET_KEY=tu_secret_key
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
CRON_SECRET=genera_un_secret_aleatorio
```

**Generar CRON_SECRET:**
```bash
openssl rand -hex 32
```

### 3. Desplegar Edge Functions en Supabase

#### Opción A: Desde Supabase CLI

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref tu-project-ref

# Desplegar funciones
supabase functions deploy automated-backup
supabase functions deploy cron-backup
```

#### Opción B: Manualmente en Dashboard

1. Ve a Edge Functions en Supabase Dashboard
2. Crea función "automated-backup"
3. Copia contenido de `supabase/functions/automated-backup/index.ts`
4. Despliega
5. Repite para "cron-backup"

### 4. Configurar Cron Job

#### Opción A: Usar Supabase Cron (Recomendado)

En Supabase Dashboard → Database → Cron Jobs:

```sql
-- Cron job para backup diario a las 2:00 AM
SELECT cron.schedule(
  'daily-backup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tu-proyecto.supabase.co/functions/v1/cron-backup',
    headers := '{"Authorization": "Bearer TU_CRON_SECRET"}'::jsonb
  );
  $$
);
```

#### Opción B: Usar Cron del Sistema (Coolify)

```bash
# En el servidor de Coolify
chmod +x scripts/setup-cron-backup.sh
./scripts/setup-cron-backup.sh
```

Sigue las instrucciones del script interactivo.

### 5. Verificar Instalación

1. **Frontend**: Ve a Sistema → Backup → Backup Automático
2. **Configuración S3**: Debe mostrar "Configurado" en verde
3. **Probar Conexión**: Haz clic en "Probar Conexión"
4. **Ejecutar Backup**: Haz clic en "Ejecutar Backup Ahora"
5. **Verificar S3**: Revisa tu bucket S3 para confirmar la subida

## Configuración

### Desde la UI

1. **Inicia sesión** como Super Admin
2. **Ve a** Sistema → Backup → Backup Automático
3. **Configurar**:
   - **Backups Automáticos**: ON/OFF
   - **Subir a S3**: ON/OFF
   - **Frecuencia**: Diario / Semanal / Mensual
   - **Hora**: HH:mm (formato 24h)
   - **Retención**: Días a mantener backups
4. **Guardar Configuración**

### Programación Recomendada

| Escenario | Frecuencia | Hora | Retención |
|-----------|-----------|------|-----------|
| Alta actividad | Diario | 02:00 | 30 días |
| Media actividad | Semanal | 02:00 | 60 días |
| Baja actividad | Mensual | 02:00 | 90 días |

## Uso del Sistema

### Ejecutar Backup Manual

1. Ve a Backup Automático
2. Haz clic en **"Ejecutar Backup Ahora"**
3. Espera confirmación (puede tardar 30-60 segundos)
4. Verifica en S3 o Historial

### Ver Historial de Backups

1. Ve a Backup Manual → Historial
2. Filtra por tipo: Manual / Automático
3. Revisa:
   - Fecha y hora
   - Tamaño
   - Tablas incluidas
   - URL de S3 (si aplica)
   - Estado

### Descargar Backup desde S3

Los backups en S3 se pueden descargar:

1. **Desde tu panel S3** (recomendado)
2. **Usando CLI de S3**:
```bash
s3cmd get s3://coffee-shop-backups/backup-2025-10-25-*.json
```
3. **Desde la UI** (próximamente)

## Estructura de Archivos de Backup

### Nombre de Archivo

```
backup-YYYY-MM-DD-timestamp.json
```

Ejemplo: `backup-2025-10-25-1729851234567.json`

### Contenido del JSON

```json
{
  "timestamp": "2025-10-25T10:30:00.000Z",
  "version": "1.0",
  "type": "automatic",
  "metadata": {
    "created_by": "cron-job",
    "created_at": "2025-10-25T10:30:00.000Z",
    "tables_count": 11
  },
  "tables": {
    "products": [ /* array de productos */ ],
    "categories": [ /* array de categorías */ ],
    "orders": [ /* array de órdenes */ ],
    ...
  }
}
```

## Monitoreo y Logs

### Ver Logs de Edge Functions

En Supabase Dashboard → Edge Functions → Logs:

```
📦 Iniciando backup automático...
✅ Tabla products: 150 registros
✅ Tabla categories: 25 registros
...
📊 Backup creado: 1234 registros, 2.5 MB
☁️ Subiendo a S3...
✅ Backup subido a S3
✅ Registro guardado en historial
```

### Ver Logs de Cron (si usas sistema)

```bash
tail -f /var/log/coffee-backups.log
```

### Estadísticas de Backups

```sql
-- Ver estadísticas por tipo
SELECT * FROM backup_statistics;

-- Ver últimos 10 backups
SELECT
  created_at,
  backup_type,
  size_mb,
  status,
  s3_url
FROM backup_history
ORDER BY created_at DESC
LIMIT 10;

-- Ver tamaño total en S3
SELECT
  backup_type,
  COUNT(*) as total_backups,
  SUM(size_mb) as total_size_mb
FROM backup_history
WHERE s3_url IS NOT NULL
GROUP BY backup_type;
```

## Mantenimiento

### Limpieza Manual de Backups Antiguos

```sql
-- Eliminar backups con más de 30 días
SELECT auto_cleanup_old_backups(30);

-- Ver backups que se eliminarán (antes de ejecutar)
SELECT id, created_at, size_mb
FROM backup_history
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Actualizar Frecuencia

```sql
-- Cambiar a semanal
UPDATE backup_config
SET schedule_frequency = 'weekly';

-- Cambiar hora a 3 AM
UPDATE backup_config
SET schedule_time = '03:00';

-- Deshabilitar backups automáticos
UPDATE backup_config
SET schedule_enabled = false;
```

### Verificar Próximo Backup

```sql
SELECT
  schedule_enabled,
  schedule_time,
  schedule_frequency,
  last_backup_at,
  next_backup_at
FROM backup_config;
```

## Troubleshooting

### ❌ Error: "S3 no configurado"

**Solución**:
1. Verifica variables de entorno en Supabase
2. Asegúrate que S3_ACCESS_KEY y S3_SECRET_KEY estén definidas
3. Prueba conexión desde la UI

### ❌ Error: "No autorizado al cron"

**Solución**:
1. Verifica que CRON_SECRET esté configurado en Supabase
2. Asegúrate de usar el mismo secret en el cron job
3. Revisa headers de la petición HTTP

### ❌ Error: "Tabla backup_config no existe"

**Solución**:
1. Ejecuta `automated_backup_setup.sql` en Supabase
2. Verifica que se creó la tabla:
```sql
SELECT * FROM backup_config;
```

### ❌ Backups no se ejecutan automáticamente

**Solución**:
1. Verifica que `schedule_enabled = true`:
```sql
SELECT schedule_enabled FROM backup_config;
```
2. Revisa logs del cron job
3. Verifica que el cron esté configurado correctamente
4. Prueba ejecución manual para descartar problemas de código

### ❌ Error al subir a S3

**Solución**:
1. Verifica credenciales S3
2. Confirma que el bucket existe
3. Revisa permisos de escritura en el bucket
4. Prueba conexión con S3 CLI:
```bash
s3cmd ls s3://coffee-shop-backups/
```

## Seguridad

### Mejores Prácticas

1. **Credenciales**:
   - Nunca expongas S3_SECRET_KEY en el frontend
   - Usa variables de entorno en Supabase
   - Rota credenciales periódicamente

2. **CRON_SECRET**:
   - Genera un secret fuerte (32+ caracteres)
   - No lo compartas
   - Guárdalo en un gestor de contraseñas

3. **Bucket S3**:
   - Usa bucket privado (no público)
   - Habilita versionado
   - Configura lifecycle rules para ahorro de costos

4. **Backups**:
   - Cifra backups sensibles antes de subir
   - Mantén backups offline adicionales
   - Prueba restauración regularmente

### Permisos Requeridos

#### Supabase RLS
```sql
-- Solo super_admin puede:
- Ver configuración de backup
- Modificar configuración
- Ejecutar backups manuales
```

#### S3 Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::coffee-shop-backups",
        "arn:aws:s3:::coffee-shop-backups/*"
      ]
    }
  ]
}
```

## Costos Estimados

### S3 Storage (Estimado)

| Backups | Tamaño/backup | Retención | Espacio | Costo/mes* |
|---------|---------------|-----------|---------|------------|
| Diarios | 5 MB | 30 días | 150 MB | $0.003 |
| Diarios | 50 MB | 30 días | 1.5 GB | $0.03 |
| Diarios | 500 MB | 30 días | 15 GB | $0.30 |

*Basado en $0.02/GB/mes (varía según proveedor)

### Supabase Edge Functions

- Gratis hasta 500K invocaciones/mes
- 1 backup/día = ~30 invocaciones/mes (muy por debajo del límite)

## Próximas Mejoras

Funcionalidades planeadas para futuras versiones:

- [ ] Restauración desde S3 con UI
- [ ] Notificaciones por email cuando falla un backup
- [ ] Backups incrementales (solo cambios)
- [ ] Compresión gzip de archivos
- [ ] Dashboard de estadísticas de backups
- [ ] Múltiples destinos S3
- [ ] Webhooks post-backup
- [ ] Tests de integridad automáticos

## FAQ

**P: ¿Puedo usar otro proveedor S3 además de Coolify?**
R: Sí, cualquier S3-compatible (AWS S3, DigitalOcean Spaces, Wasabi, etc.)

**P: ¿Los backups incluyen imágenes y archivos?**
R: No, solo datos de tablas. Para archivos usa Supabase Storage backup.

**P: ¿Puedo pausar backups temporalmente?**
R: Sí, deshabilita `schedule_enabled` en la configuración.

**P: ¿Cuánto tarda un backup?**
R: Depende del tamaño de datos. Típicamente 30-60 segundos para DBs pequeñas.

**P: ¿Puedo hacer backup de tablas específicas?**
R: Sí, edita la lista `tables` en la configuración.

## Soporte

- **Documentación**: Ver archivos README en el proyecto
- **Logs**: Revisar Edge Functions logs en Supabase
- **Issues**: Reportar en el repositorio del proyecto

---

**Versión**: 1.0
**Última actualización**: Octubre 2025
**Mantenido por**: Equipo de Desarrollo LIN-Caisse
