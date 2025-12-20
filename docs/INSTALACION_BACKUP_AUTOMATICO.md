# Instalación - Sistema de Backup Automático con S3

## 🚀 Guía Rápida de Instalación

Esta guía te llevará paso a paso para instalar el sistema completo de backups automáticos con almacenamiento en S3.

---

## ✅ Checklist de Instalación

- [ ] 1. Ejecutar SQL para backup manual (si aún no lo hiciste)
- [ ] 2. Ejecutar SQL para backup automático
- [ ] 3. Configurar variables S3 en Supabase
- [ ] 4. Desplegar Edge Functions
- [ ] 5. Configurar Cron Job
- [ ] 6. Probar el sistema
- [ ] 7. Commit y deploy

---

## 📋 PASO 1: SQL para Backup Manual

Si aún no lo hiciste, ejecuta primero:

```sql
-- En Supabase SQL Editor
-- Copia y pega: supabase/migrations/backup_simple.sql
```

✅ Verifica que se creó el permiso `backup` en `role_permissions`

---

## 📋 PASO 2: SQL para Backup Automático

En Supabase SQL Editor, ejecuta:

```sql
-- Copia y pega el contenido completo de:
-- supabase/migrations/automated_backup_setup.sql
```

Esto creará:
- ✅ Tabla `backup_config` con configuración por defecto
- ✅ Columnas `s3_url` y `file_name` en `backup_history`
- ✅ Políticas RLS para seguridad
- ✅ Triggers automáticos para cálculo de próximo backup
- ✅ Función de limpieza automática
- ✅ Vista `backup_statistics`

**Verificación:**
```sql
SELECT * FROM backup_config;
-- Debe mostrar 1 registro con la configuración por defecto
```

---

## 🔐 PASO 3: Configurar Variables S3

### 3.1 Generar CRON_SECRET

```bash
# En tu terminal local
openssl rand -hex 32
# Copia el resultado
```

### 3.2 Agregar Variables en Supabase

Ve a: **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**

Agrega:

```env
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_ACCESS_KEY=0FIGEHTSRQYUALFOLUZS
S3_SECRET_KEY=3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
CRON_SECRET=<el-secret-que-generaste>
```

**Nota**: Usa tus credenciales reales de S3 configuradas en Coolify.

---

## 🔧 PASO 4: Desplegar Edge Functions

### Opción A: Usando Supabase CLI (Recomendado)

```bash
# Instalar CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Link al proyecto (usa tu project-ref de Supabase)
supabase link --project-ref TU-PROJECT-REF

# Desplegar funciones
supabase functions deploy automated-backup
supabase functions deploy cron-backup

# Verificar
supabase functions list
```

### Opción B: Manualmente desde Dashboard

1. Ve a **Edge Functions** en Supabase Dashboard
2. Click en **Create function**
3. Nombre: `automated-backup`
4. Copia todo el contenido de `supabase/functions/automated-backup/index.ts`
5. Pega en el editor
6. Click en **Deploy**
7. Repite para `cron-backup` con su respectivo archivo

**Verificación:**
- Ambas funciones deben aparecer en la lista
- Estado: ✅ Deployed

---

## ⏰ PASO 5: Configurar Cron Job

Tienes 2 opciones:

### Opción A: Supabase Cron (Más Fácil) ⭐

En Supabase SQL Editor:

```sql
-- Crear cron job para backup diario a las 2:00 AM
SELECT cron.schedule(
  'daily-automatic-backup',
  '0 2 * * *',  -- A las 2:00 AM todos los días
  $$
  SELECT net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/cron-backup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TU-CRON-SECRET-AQUI',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

**Reemplaza**:
- `TU-PROYECTO` por tu URL de Supabase
- `TU-CRON-SECRET-AQUI` por el secret que generaste

**Verificar cron:**
```sql
SELECT * FROM cron.job;
-- Debe aparecer 'daily-automatic-backup'
```

### Opción B: Cron del Sistema (Coolify)

Si tienes acceso SSH al servidor de Coolify:

```bash
# Hacer ejecutable
chmod +x scripts/setup-cron-backup.sh

# Ejecutar script interactivo
./scripts/setup-cron-backup.sh
```

Sigue las instrucciones del script.

---

## 🧪 PASO 6: Probar el Sistema

### 6.1 Desde la UI

1. **Login** como Super Admin
2. **Ve a** Sistema → Backup → Backup Automático
3. **Verifica**:
   - Estado S3: "Configurado" (verde)
   - Configuración cargada correctamente

4. **Prueba conexión S3**:
   - Click en "Probar Conexión"
   - Debe mostrar: "✓ Conexión exitosa con S3"

5. **Ejecuta backup manual**:
   - Click en "Ejecutar Backup Ahora"
   - Espera 30-60 segundos
   - Debe mostrar: "Backup automático completado: X registros (Y MB)"

6. **Verifica en historial**:
   - Ve a tab "Backup Manual"
   - Debe aparecer el backup recién creado
   - Tipo: "Automático"
   - Estado: "Completado"

### 6.2 Desde Supabase

```sql
-- Ver último backup
SELECT *
FROM backup_history
ORDER BY created_at DESC
LIMIT 1;

-- Ver configuración
SELECT
  schedule_enabled,
  s3_enabled,
  schedule_time,
  schedule_frequency,
  next_backup_at
FROM backup_config;
```

### 6.3 Desde S3

Verifica que el archivo se subió a tu bucket:
- Bucket: `coffee-shop-backups`
- Archivo: `backup-2025-XX-XX-XXXXXXXXX.json`

---

## 📦 PASO 7: Commit y Deploy

```bash
git add .
git commit -m "Implementar sistema de backup automático con S3"
git push
```

Coolify desplegará automáticamente los cambios.

---

## 🎛️ Configuración Post-Instalación

### Habilitar Backups Automáticos

Por defecto, los backups automáticos están **DESHABILITADOS**.

Para habilitarlos:

**Opción 1 - Desde UI:**
1. Ve a Sistema → Backup → Backup Automático
2. Activa "Backups Automáticos" (toggle)
3. Configura:
   - Frecuencia: Diario / Semanal / Mensual
   - Hora: 02:00 (recomendado)
   - Retención: 30 días
4. Click en "Guardar Configuración"

**Opción 2 - Desde SQL:**
```sql
UPDATE backup_config
SET
  schedule_enabled = true,
  schedule_time = '02:00',
  schedule_frequency = 'daily',
  retention_days = 30;
```

---

## 📊 Monitoreo

### Ver Logs de Backups

**Supabase Edge Functions:**
- Dashboard → Edge Functions → cron-backup → Logs

**Sistema (si usas cron del servidor):**
```bash
tail -f /var/log/coffee-backups.log
```

### Estadísticas

```sql
-- Ver estadísticas generales
SELECT * FROM backup_statistics;

-- Ver últimos 10 backups
SELECT
  created_at,
  backup_type,
  size_mb,
  status,
  CASE
    WHEN s3_url IS NOT NULL THEN 'S3'
    ELSE 'Local'
  END as storage
FROM backup_history
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 Troubleshooting

### Problema: No aparece tab "Backup Automático"

**Solución**:
1. Verifica que ejecutaste `automated_backup_setup.sql`
2. Limpia caché del navegador
3. Recarga la aplicación

### Problema: Error "S3 no configurado"

**Solución**:
1. Verifica que agregaste las variables en Supabase Edge Functions
2. Las variables deben empezar con `S3_` (no `VITE_S3_`)
3. Redespliega las Edge Functions después de agregar variables

### Problema: Cron no ejecuta backups

**Solución**:
1. Verifica que `schedule_enabled = true`
2. Revisa que el cron job está creado:
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-automatic-backup';
```
3. Revisa logs del cron
4. Prueba ejecución manual de la Edge Function

### Problema: Edge Function falla al desplegar

**Solución**:
1. Verifica sintaxis del código TypeScript
2. Asegúrate de tener Deno habilitado
3. Revisa que todas las dependencias estén disponibles
4. Intenta desplegar desde CLI en lugar de Dashboard

---

## 📁 Archivos Creados

```
Coffe/
├── supabase/
│   ├── migrations/
│   │   ├── backup_simple.sql (manual)
│   │   └── automated_backup_setup.sql (automático)
│   └── functions/
│       ├── automated-backup/
│       │   └── index.ts
│       └── cron-backup/
│           └── index.ts
├── src/
│   ├── components/
│   │   ├── BackupManager.tsx (actualizado con tabs)
│   │   └── AutomatedBackupConfig.tsx (nuevo)
│   └── lib/
│       └── s3BackupService.ts (nuevo)
├── scripts/
│   └── setup-cron-backup.sh
├── SISTEMA_BACKUP_README.md
├── BACKUP_AUTOMATICO_S3.md
├── INSTALACION_BACKUP.md
└── INSTALACION_BACKUP_AUTOMATICO.md (este archivo)
```

---

## 🎯 Próximos Pasos

Una vez instalado:

1. ✅ Habilita backups automáticos
2. ✅ Programa frecuencia apropiada
3. ✅ Monitorea primer backup automático
4. ✅ Verifica que se sube a S3
5. ✅ Configura alertas (opcional)
6. ✅ Documenta tu configuración específica

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa logs de Edge Functions en Supabase
2. Verifica variables de entorno
3. Consulta `BACKUP_AUTOMATICO_S3.md` para detalles
4. Revisa troubleshooting en documentación

---

## ✨ Resumen

Ahora tienes:
- ✅ Backups manuales con descarga JSON
- ✅ Backups automáticos programados
- ✅ Almacenamiento en S3
- ✅ Limpieza automática de backups antiguos
- ✅ UI completa de configuración
- ✅ Historial detallado
- ✅ Monitoreo y estadísticas

**¡Tu sistema de backups está listo! 🎉**

---

**Versión**: 1.0
**Fecha**: Octubre 2025
**Mantenido por**: Equipo LIN-Caisse
