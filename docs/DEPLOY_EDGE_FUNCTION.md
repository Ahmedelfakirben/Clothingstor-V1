# Cómo Desplegar Edge Function para S3

## ⚠️ IMPORTANTE

**NO** ejecutes el código TypeScript en SQL Editor. Las Edge Functions se despliegan de forma diferente.

---

## ✅ MÉTODO 1: Supabase CLI (Recomendado)

### Paso 1: Instalar Supabase CLI

```bash
# Windows (con npm)
npm install -g supabase

# O con Chocolatey
choco install supabase
```

### Paso 2: Login en Supabase

```bash
supabase login
```

Se abrirá tu navegador para autorizar. Copia el token y pégalo en la terminal.

### Paso 3: Link al Proyecto

```bash
# Desde el directorio del proyecto
cd C:\Users\Admin\Desktop\Coffe\Coffe

# Link al proyecto (necesitas tu project-ref)
# Lo encuentras en: Dashboard → Project Settings → General → Reference ID
supabase link --project-ref TU-PROJECT-REF
```

### Paso 4: Desplegar la Función

```bash
# Desplegar la función s3-upload-hetzner
supabase functions deploy s3-upload-hetzner

# Espera el mensaje:
# Deployed Function s3-upload-hetzner ✓
```

### Paso 5: Verificar

```bash
# Listar funciones desplegadas
supabase functions list

# Debe aparecer:
# s3-upload-hetzner
```

---

## ✅ MÉTODO 2: Desde Dashboard (Manual)

Si no puedes usar la CLI, sigue estos pasos:

### Paso 1: Ir a Edge Functions

1. Abre **Supabase Dashboard**
2. Selecciona tu proyecto
3. Ve a **Edge Functions** (en el menú lateral)

### Paso 2: Crear Nueva Función

1. Click en **"Create a new function"** o **"+ New function"**
2. Nombre: `s3-upload-hetzner`
3. Click en **Create function**

### Paso 3: Copiar el Código

1. Abre el archivo: `supabase/functions/s3-upload-hetzner/index.ts`
2. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
3. En el dashboard, **pega el código** en el editor

### Paso 4: Configurar Variables (si no lo hiciste)

1. En el mismo Dashboard, ve a la pestaña **"Secrets"** o **"Environment Variables"**
2. O ve a **Settings** → **Edge Functions** → **Secrets**
3. Agrega las variables:

```
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_ACCESS_KEY=0FIGEHTSRQYUALFOLUZS
S3_SECRET_KEY=3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
```

### Paso 5: Desplegar

1. Click en **"Deploy"** o **"Save & Deploy"**
2. Espera a que termine el deployment
3. Debe mostrar: **"Deployed successfully"** ✅

---

## 🔍 Verificar que Funcionó

### Opción 1: Desde el Dashboard

1. Ve a **Edge Functions** en el dashboard
2. Debe aparecer `s3-upload-hetzner` en la lista
3. Estado: **Deployed** (verde)

### Opción 2: Probar la Función

1. En el dashboard de la función, busca la **URL**:
   ```
   https://TU-PROJECT.supabase.co/functions/v1/s3-upload-hetzner
   ```

2. Prueba con curl (opcional):
   ```bash
   curl -X POST https://TU-PROJECT.supabase.co/functions/v1/s3-upload-hetzner \
     -H "Authorization: Bearer TU-ANON-KEY" \
     -H "Content-Type: application/json" \
     -d '{"backupData": {}, "fileName": "test.json"}'
   ```

---

## 🐛 Troubleshooting

### Error: "supabase: command not found"

**Solución**: Instala Supabase CLI:
```bash
npm install -g supabase
```

### Error: "Project ref not found"

**Solución**:
1. Ve a Dashboard → Settings → General
2. Copia el **Reference ID**
3. Úsalo en el comando link:
   ```bash
   supabase link --project-ref tu-reference-id-aqui
   ```

### Error: "Not authorized"

**Solución**:
1. Ejecuta `supabase login` de nuevo
2. Asegúrate de copiar el token completo
3. Verifica que tienes permisos en el proyecto

### Error: "Function already exists"

**Solución**:
- La función ya está desplegada
- Para actualizarla, solo ejecuta deploy de nuevo:
  ```bash
  supabase functions deploy s3-upload-hetzner
  ```

### No veo la función en el Dashboard

**Solución**:
1. Refresca la página (F5)
2. Verifica que estás en el proyecto correcto
3. Espera unos segundos, el deployment puede tardar

---

## 📋 Checklist Post-Deploy

Después de desplegar, verifica:

- [ ] Función aparece en Edge Functions list
- [ ] Estado: Deployed (verde)
- [ ] Variables S3 configuradas en Secrets
- [ ] URL de la función disponible
- [ ] Puedes ver logs de la función

---

## 🚀 Siguiente Paso

Una vez desplegada la función:

1. **Haz commit y push** del código actualizado:
   ```bash
   git add .
   git commit -m "Fix: Implementar subida real a S3 con Edge Function"
   git push
   ```

2. **Espera** a que Coolify despliegue

3. **Prueba** desde la UI:
   - Login como Super Admin
   - Sistema → Backup → Backup Automático
   - Click "Ejecutar Backup Ahora"

4. **Verifica** en Hetzner que el archivo se subió

---

## 💡 Tip

Si usas frecuentemente Edge Functions, configura un alias:

```bash
# En tu .bashrc o .zshrc
alias sfd='supabase functions deploy'
alias sfl='supabase functions list'
alias sflog='supabase functions logs'
```

Luego:
```bash
sfd s3-upload-hetzner  # Deploy
sfl                    # List
sflog s3-upload-hetzner # Ver logs
```

---

## 📞 ¿Necesitas Ayuda?

Si encuentras errores:
1. Copia el mensaje de error completo
2. Revisa los logs en: Dashboard → Edge Functions → s3-upload-hetzner → Logs
3. Verifica que las variables estén configuradas
4. Asegúrate que el bucket existe en Hetzner

---

**¿Cuál método vas a usar? ¿CLI o Dashboard?**
