# 🚀 Deploy en Coolify - Coffee Shop App

## 📋 Problema Resuelto

El error que estabas viendo:
```
error: Uncaught SyntaxError: The requested module 'https://deno.land/x/s3_lite_client@0.6.1/mod.ts'
does not provide an export named 'PutObjectCommand'
```

**Causa:** Coolify estaba intentando ejecutar los archivos de Edge Functions de Supabase (archivos TypeScript para Deno) que están en `supabase/functions/`.

**Solución:**
- ✅ Creado `.dockerignore` para excluir toda la carpeta `supabase/`
- ✅ Creado `Dockerfile` optimizado para Coolify
- ✅ Creado `nixpacks.toml` para forzar build correcto
- ✅ Las Edge Functions NO deben ejecutarse en Coolify (son para Supabase)

---

## 🔧 Configuración en Coolify

### 1. Variables de Entorno Necesarias

En Coolify, configura las siguientes variables:

```env
# Supabase
VITE_SUPABASE_URL=https://tu-dominio.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

# S3 Storage (Hetzner)
VITE_S3_ENDPOINT=https://fsn1.your-objectstorage.com
VITE_S3_ACCESS_KEY=tu_access_key
VITE_S3_SECRET_KEY=tu_secret_key
VITE_S3_BUCKET_NAME=coffee-shop-backups
VITE_S3_REGION=eu-central-1

# API URL (si usas el servidor de backup)
VITE_API_URL=https://tu-dominio.com
```

### 2. Configuración de Build en Coolify

**Opción A: Build automático con Dockerfile** (Recomendado)
- Build Command: `(vacío, usa el Dockerfile)`
- Start Command: `(vacío, usa el Dockerfile)`
- Puerto: `3000`

**Opción B: Build manual sin Docker**
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Puerto: `3000`

### 3. Configuración de Puertos

- **Puerto de la App**: `3000`
- Si usas el servidor de backup API: Puerto adicional `3001`

---

## 📁 Estructura del Proyecto

```
coffee-shop/
├── src/                    # Código fuente React
├── dist/                   # Build de producción (generado)
├── supabase/
│   ├── functions/          # ❌ NO se ejecutan en Coolify
│   └── migrations/         # ❌ NO se ejecutan en Coolify
├── api/                    # Servidor Node.js para S3 (opcional)
│   └── backup-to-s3.js
├── Dockerfile              # ✅ Para Coolify
├── .dockerignore           # ✅ Excluye supabase/functions
└── package.json
```

---

## 🐳 ¿Qué hace el Dockerfile?

1. **Etapa Build**:
   - Instala dependencias con `npm ci`
   - Ejecuta `npm run build` → genera carpeta `dist/`
   - Excluye `supabase/functions/` (gracias a `.dockerignore`)

2. **Etapa Producción**:
   - Usa imagen ligera Alpine
   - Instala `serve` globalmente
   - Sirve archivos estáticos desde `dist/`
   - Expone puerto 3000

---

## 🔍 Verificación

Después del deploy, verifica:

1. ✅ App accesible en `https://tu-dominio.com`
2. ✅ Login funciona correctamente
3. ✅ Conexión a Supabase OK
4. ✅ NO hay errores de Deno/Edge Functions
5. ✅ Cambio de divisa funciona
6. ✅ Cambio de idioma funciona
7. ✅ POS carga productos

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'serve'"
**Solución:** Asegúrate que `package.json` incluye `"serve": "^14.2.5"` en dependencies

### Error: "404 Not Found" en rutas
**Solución:** El comando `serve -s dist` maneja SPA routing automáticamente

### Error: Variables de entorno no definidas
**Solución:**
- En Coolify, asegúrate que las variables empiecen con `VITE_`
- Reconstruye la app después de agregar variables

### Error: Supabase Edge Functions
**Solución:**
- Las Edge Functions se ejecutan en Supabase, NO en Coolify
- Si usas backups a S3, usa el servidor Node.js (`api/backup-to-s3.js`)

---

## 📦 Servidor de Backup S3 (Opcional)

Si necesitas backups automáticos a S3:

### Opción 1: PM2 (Recomendado para Coolify)

Modifica el `Dockerfile` para incluir el servidor API:

```dockerfile
# Etapa producción con API
FROM node:18-alpine AS production

WORKDIR /app

# Instalar serve y pm2
RUN npm install -g serve pm2

# Copiar build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api

EXPOSE 3000 3001

# Crear ecosystem.config.js para PM2
RUN echo 'module.exports = { \
  apps: [ \
    { name: "frontend", script: "serve", args: "-s dist -l 3000" }, \
    { name: "backup-api", script: "api/backup-to-s3.js" } \
  ] \
}' > ecosystem.config.js

CMD ["pm2-runtime", "ecosystem.config.js"]
```

### Opción 2: Dos servicios separados en Coolify

1. **Servicio Frontend** (puerto 3000)
2. **Servicio API** (puerto 3001)

---

## ✅ Checklist Pre-Deploy

- [ ] Variables de entorno configuradas en Coolify
- [ ] `.dockerignore` existe y excluye `supabase/functions`
- [ ] `Dockerfile` existe
- [ ] Credenciales S3 de Hetzner correctas
- [ ] URL de Supabase configurada
- [ ] Supabase RLS policies habilitadas
- [ ] Migración SQL de divisas ejecutada en Supabase
- [ ] Super admin user creado en Supabase

---

## 🎯 Resultado Esperado

Después del deploy exitoso:

```
✅ App corriendo en https://tu-dominio.com
✅ Sin errores de Deno/Edge Functions
✅ Conexión a Supabase funcionando
✅ Login/Logout OK
✅ POS mostrando productos
✅ Cambio de idioma (ES/FR) OK
✅ Cambio de tema OK
✅ Cambio de divisa (EUR/USD/MAD/etc.) OK
✅ Backups (si configurado) OK
```

---

## 📞 Soporte

Si encuentras errores:

1. Revisa logs en Coolify
2. Verifica variables de entorno
3. Asegúrate que `.dockerignore` excluye `supabase/functions`
4. Verifica que el build se completó sin errores

---

**¡Listo!** Tu aplicación debería funcionar perfectamente en Coolify sin errores de Edge Functions. 🚀
