# Instalación API de Backup a S3 - SOLUCIÓN SIMPLE

## 🎯 Solución para Supabase Self-Hosted

Como tienes Supabase self-hosted, vamos a usar un **servidor API Node.js simple** para subir a S3.

---

## 🚀 Instalación Rápida (5 minutos)

### PASO 1: Iniciar el servidor API

```bash
# Desde el directorio del proyecto
cd C:\Users\Admin\Desktop\Coffe\Coffe

# Iniciar el servidor
node api/backup-to-s3.js
```

Debes ver:
```
🚀 Servidor de backup escuchando en http://localhost:3001
📡 Endpoint: POST http://localhost:3001/api/backup-to-s3
☁️  S3 Endpoint: fsn1.your-objectstorage.com
📦 Bucket: coffee-shop-backups
```

### PASO 2: En otra terminal, iniciar frontend

```bash
# En otra ventana de terminal
cd C:\Users\Admin\Desktop\Coffe\Coffe
npm run dev
```

### PASO 3: Probar

1. Abre http://localhost:5173
2. Login como Super Admin
3. Ve a Sistema → Backup → Backup Automático
4. Click "Ejecutar Backup Ahora"
5. **Verifica en Hetzner** que se subió el archivo

---

## 🔧 Para Producción (Coolify)

### Opción A: Agregar al package.json

Actualiza tu `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "node api/backup-to-s3.js & serve dist",
    "api": "node api/backup-to-s3.js"
  }
}
```

### Opción B: Usar PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar API
pm2 start api/backup-to-s3.js --name backup-api

# Iniciar frontend
pm2 start npm --name frontend -- start

# Ver logs
pm2 logs

# Guardar configuración
pm2 save
pm2 startup
```

### Opción C: Docker Compose (para Coolify)

Crear `docker-compose.yml`:

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://api:3001

  api:
    build: .
    command: node api/backup-to-s3.js
    ports:
      - "3001:3001"
    environment:
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - S3_REGION=${S3_REGION}
```

---

## 🔐 Variables de Entorno

### En Desarrollo (local)

El API ya usa las credenciales del `.env`:
```env
S3_ENDPOINT=fsn1.your-objectstorage.com
S3_ACCESS_KEY=0FIGEHTSRQYUALFOLUZS
S3_SECRET_KEY=3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
```

### En Producción (Coolify)

Agrega las variables de entorno en Coolify:
```
S3_ENDPOINT=fsn1.your-objectstorage.com
S3_ACCESS_KEY=0FIGEHTSRQYUALFOLUZS
S3_SECRET_KEY=3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW
S3_BUCKET_NAME=coffee-shop-backups
S3_REGION=eu-central-1
VITE_API_URL=https://tu-dominio.com
```

---

## 🧪 Probar manualmente

```bash
# Probar el endpoint
curl -X POST http://localhost:3001/api/backup-to-s3 \
  -H "Content-Type: application/json" \
  -d '{
    "backupData": {"test": "data"},
    "fileName": "test-backup.json"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "url": "https://fsn1.your-objectstorage.com/coffee-shop-backups/test-backup.json",
  "statusCode": 200
}
```

---

## 🔍 Verificar en Hetzner

### Panel Web:
1. Accede a Hetzner Cloud Console
2. Object Storage
3. Bucket: `coffee-shop-backups`
4. Debes ver: `backup-2025-XX-XX-*.json`

### CLI:
```bash
s3cmd ls s3://coffee-shop-backups/
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'http'"
- Node.js no está instalado correctamente
- Solución: Reinstala Node.js

### Error: "EADDRINUSE: address already in use"
- El puerto 3001 ya está en uso
- Solución: Cambia el puerto en `.env`:
  ```
  PORT=3002
  ```

### Error: "fetch is not defined"
- Node.js versión antigua
- Solución: Actualiza a Node.js 18+

### Error 403 en S3
- Credenciales incorrectas
- Solución: Verifica access key y secret key

### Error 404 en S3
- Bucket no existe
- Solución: Crea el bucket en Hetzner

### No se conecta al API
- Verifica que el servidor está corriendo
- Revisa VITE_API_URL en .env
- Asegúrate que no hay firewall bloqueando

---

## 📦 Desplegar a Coolify

1. **Commit los cambios**:
```bash
git add .
git commit -m "Add API endpoint for S3 backup uploads"
git push
```

2. **En Coolify**, asegúrate de:
   - Agregar variables de entorno S3
   - Configurar puerto 3001
   - Iniciar ambos servicios (frontend y API)

3. **Configurar Dockerfile** (si es necesario):
```dockerfile
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Exponer puertos
EXPOSE 5173 3001

# Iniciar ambos servicios
CMD ["sh", "-c", "node api/backup-to-s3.js & npm run dev"]
```

---

## ✅ Checklist

- [ ] Node.js instalado (v18+)
- [ ] Archivo `api/backup-to-s3.js` existe
- [ ] Servidor API corriendo en puerto 3001
- [ ] Frontend corriendo en puerto 5173
- [ ] Variables S3 configuradas
- [ ] Bucket existe en Hetzner
- [ ] Backup ejecutado con éxito
- [ ] Archivo visible en Hetzner

---

## 🎬 Video Tutorial Conceptual

```
Terminal 1:
cd C:\Users\Admin\Desktop\Coffe\Coffe
node api/backup-to-s3.js
→ Servidor corriendo ✅

Terminal 2:
npm run dev
→ Frontend corriendo ✅

Navegador:
http://localhost:5173
→ Login → Backup → Ejecutar
→ Verificar en Hetzner ✅
```

---

**¿Funcionó? ¡Avísame si ves algún error!** 🚀
