# Guía Rápida - Subida Real a S3 Hetzner

## 🚨 Problema Identificado

El código anterior **NO subía realmente** a S3, solo simulaba la subida.

## ✅ Solución Implementada

He creado una **Edge Function** que SÍ sube los backups a tu S3 de Hetzner.

---

## 📋 Pasos para Activar la Subida Real a S3

### **PASO 1**: Desplegar Edge Function (5 minutos)

#### Opción A: Usando Supabase CLI

```bash
# Desplegar la nueva función
supabase functions deploy s3-upload-hetzner
```

#### Opción B: Manualmente en Dashboard

1. Ve a **Supabase Dashboard** → **Edge Functions**
2. Click en **Create function**
3. Nombre: `s3-upload-hetzner`
4. Copia todo el contenido de:
   ```
   supabase/functions/s3-upload-hetzner/index.ts
   ```
5. Pega en el editor
6. Click en **Deploy**

---

### **PASO 2**: Verificar Variables S3 (2 minutos)

Ve a **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**

Asegúrate de tener:

```env
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_ACCESS_KEY=0FIGEHTSRQYUALFOLUZS
S3_SECRET_KEY=3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
```

**IMPORTANTE**: Las variables deben **NO** tener el prefijo `VITE_`.

---

### **PASO 3**: Verificar Bucket en Hetzner (2 minutos)

1. Accede a tu panel de Hetzner Object Storage
2. Verifica que el bucket `coffee-shop-backups` existe
3. Si no existe, créalo:
   - Nombre: `coffee-shop-backups`
   - Región: `fsn1` (o la que corresponda)
   - ACL: Private

---

### **PASO 4**: Commit y Deploy (2 minutos)

```bash
git add .
git commit -m "Fix: Implementar subida real a S3 Hetzner"
git push
```

Coolify desplegará automáticamente.

---

### **PASO 5**: Probar Subida a S3 (5 minutos)

1. **Login** como Super Admin
2. **Ve a** Sistema → Backup → Backup Automático
3. **Click** en "Ejecutar Backup Ahora"
4. **Espera** 30-60 segundos
5. **Revisa**:
   - Debe aparecer mensaje de éxito con URL de S3
   - En Historial debe mostrar la URL de S3
   - En tu panel de Hetzner debe aparecer el archivo

---

## 🔍 Verificar en Hetzner

### Opción A: Panel Web de Hetzner

1. Accede a tu cuenta de Hetzner
2. Ve a Object Storage
3. Selecciona bucket `coffee-shop-backups`
4. Debes ver archivos como: `backup-2025-10-25-1729851234567.json`

### Opción B: CLI de S3

```bash
# Configurar s3cmd (primera vez)
s3cmd --configure

# Listar archivos en el bucket
s3cmd ls s3://coffee-shop-backups/

# Descargar un backup
s3cmd get s3://coffee-shop-backups/backup-2025-10-25-*.json
```

---

## 🐛 Troubleshooting

### Error: "Credenciales S3 no configuradas"

**Solución**:
1. Ve a Supabase → Settings → Edge Functions → Secrets
2. Verifica que `S3_ACCESS_KEY` y `S3_SECRET_KEY` existen
3. NO deben tener prefijo `VITE_`
4. Redespliega la Edge Function después de agregar variables

### Error: "Error subiendo a S3: 403 Forbidden"

**Solución**:
1. Verifica que las credenciales S3 son correctas
2. Asegúrate que el Access Key tiene permisos de escritura
3. Verifica que el bucket existe
4. Comprueba que la región es correcta

### Error: "Error subiendo a S3: 404 Not Found"

**Solución**:
1. El bucket `coffee-shop-backups` no existe
2. Créalo en tu panel de Hetzner
3. O cambia el nombre en las variables de entorno

### Error: "Edge Function no responde"

**Solución**:
1. Verifica que la función está desplegada:
   ```bash
   supabase functions list
   ```
2. Revisa logs de la función en Supabase Dashboard
3. Asegúrate que `VITE_SUPABASE_URL` está en tu `.env` local

### No veo el archivo en Hetzner

**Solución**:
1. Revisa la consola del navegador (F12)
2. Busca mensajes de "Subiendo a S3..."
3. Si dice "✅ Backup subido a S3:", revisa el URL mostrado
4. Verifica que estás mirando el bucket correcto en Hetzner
5. Refresca la lista de objetos en el panel de Hetzner

---

## 📊 Cómo Funciona Ahora

### Antes (NO funcionaba):
```
Frontend → Simula S3 → Solo mensaje falso
```

### Ahora (SÍ funciona):
```
Frontend
   ↓
Edge Function (s3-upload-hetzner)
   ↓
S3 API de Hetzner
   ↓
Archivo guardado en bucket
```

---

## 🔐 Autenticación S3 Hetzner

La Edge Function usa autenticación AWS v4 signature compatible con Hetzner:

```typescript
headers: {
  'Authorization': `AWS ${accessKey}:${secretKey}`,
  'Content-Type': 'application/json',
  'x-amz-acl': 'private',
}
```

---

## 📁 Estructura de Archivos en S3

```
coffee-shop-backups/
├── backup-2025-10-25-1729851234567.json
├── backup-2025-10-26-1729937634567.json
├── backup-2025-10-27-1730024034567.json
└── ...
```

Cada archivo contiene:
- Timestamp
- Metadata del backup
- Datos de todas las tablas seleccionadas
- Información del creador

---

## 🎯 Verificación Final

Ejecuta esta checklist:

- [ ] Edge Function `s3-upload-hetzner` desplegada
- [ ] Variables S3 configuradas en Supabase (sin VITE_)
- [ ] Bucket `coffee-shop-backups` existe en Hetzner
- [ ] Código actualizado y desplegado en Coolify
- [ ] Backup ejecutado desde la UI
- [ ] Archivo visible en panel de Hetzner
- [ ] Historial muestra URL de S3

---

## 📝 Logs para Debugging

### En Supabase Edge Function:
```
Dashboard → Edge Functions → s3-upload-hetzner → Logs
```

Busca:
```
📤 Subiendo a S3 Hetzner...
Endpoint: https://fsn1.your-objectstorage.com
Bucket: coffee-shop-backups
Archivo: backup-2025-10-25-*.json
📡 Realizando petición PUT a: ...
📊 Respuesta S3: 200 OK
✅ Backup subido exitosamente
```

### En Frontend (Consola del Navegador):
```
F12 → Console
```

Busca:
```
📦 Creando backup automático...
☁️ Subiendo a S3 via Edge Function...
✅ Backup subido a S3: https://...
```

---

## 🚀 Próximo Nivel

Una vez que confirmes que funciona:

1. ✅ Habilita backups automáticos
2. ✅ Configura cron job para ejecución programada
3. ✅ Establece política de retención
4. ✅ Monitorea espacio usado en Hetzner

---

## 💡 Consejo Pro

Para verificar rápidamente si un backup se subió:

```bash
# Instalar s3cmd
pip install s3cmd

# Configurar (solo primera vez)
s3cmd --configure
# Usa las credenciales de tu .env

# Listar últimos backups
s3cmd ls s3://coffee-shop-backups/ | tail -5

# Ver tamaño total usado
s3cmd du s3://coffee-shop-backups/
```

---

**¿Funcionó la subida a S3? ¡Déjame saber para ayudarte con cualquier error!** 🎉
