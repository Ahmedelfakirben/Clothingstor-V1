# 🚀 CÓMO INSTALAR - LIN-Fashion (Tienda de Ropa)

## ⚡ Instalación Rápida (3 pasos)

### 📋 PASO 1: Ejecutar Migración en Supabase (5 minutos)

1. Ve a https://supabase.com/dashboard
2. Abre tu proyecto: `https://zeqootmdlfpospbwwzuh.supabase.co`
3. Haz clic en **"SQL Editor"** (menú lateral izquierdo)
4. Haz clic en **"New Query"**
5. Abre el archivo: `MIGRACION_COMPLETA_TIENDA_ROPA.sql`
6. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
7. **Pégalo** en el editor de Supabase (Ctrl+V)
8. Haz clic en **"Run"** (botón verde esquina inferior derecha)
9. ✅ Espera que termine (verás "Success" abajo)

---

### 👤 PASO 2: Crear tu Usuario Super Admin (2 minutos)

#### A. Crear usuario en Authentication
1. En Supabase, ve a **"Authentication"** → **"Users"**
2. Haz clic en **"Add User"** → **"Create new user"**
3. Ingresa:
   - **Email**: `tu@email.com` (el que usarás para entrar)
   - **Password**: `TuContraseñaSegura123`
4. Haz clic en **"Create user"**
5. ✅ **COPIA EL ID** que aparece (algo como: `f7b3c8a2-1234-5678-9abc-def012345678`)

#### B. Asignar rol Super Admin
1. Ve de nuevo a **"SQL Editor"** → **"New Query"**
2. Pega este código (REEMPLAZA con tu email y tu ID):

```sql
-- IMPORTANTE: Reemplaza estos valores con los tuyos
INSERT INTO employee_profiles (id, email, full_name, role)
VALUES (
  'f7b3c8a2-1234-5678-9abc-def012345678',  -- ⬅️ REEMPLAZA con tu ID copiado
  'tu@email.com',                           -- ⬅️ REEMPLAZA con tu email
  'Administrador Principal',                -- Puedes cambiar el nombre
  'super_admin'
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin', email = EXCLUDED.email, full_name = EXCLUDED.full_name;
```

3. Haz clic en **"Run"**
4. ✅ Deberías ver "Success"

---

### 💻 PASO 3: Instalar y Ejecutar la Aplicación (3 minutos)

Abre **PowerShell** o **CMD** y ejecuta:

```bash
# 1. Ve a la carpeta del proyecto
cd C:\Users\Admin\Desktop\ClothingStore

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Ejecuta la aplicación
npm run dev
```

4. Abre tu navegador en: **http://localhost:5173**
5. **Inicia sesión** con tu email y contraseña
6. ✅ ¡Listo! Ya tienes acceso como Super Admin

---

## 🎯 ¿Qué hacer después?

### Primera vez en la app:
1. Ve a **"Configuración de Empresa"** y completa los datos de tu tienda
2. Ve a **"Categorías"** y agrega categorías de ropa:
   - Camisetas
   - Pantalones
   - Vestidos
   - Calzado
   - Accesorios
3. Ve a **"Productos"** y agrega tu primer producto con:
   - Nombre (ej. "Camiseta Nike Dri-FIT")
   - Categoría
   - Marca (Nike)
   - Género (Hombre/Mujer/Unisex)
   - Precio
   - Stock inicial

---

## 📸 Subir Imágenes de Productos (OPCIONAL)

Si quieres subir fotos de productos:

1. En Supabase, ve a **"Storage"**
2. Haz clic en **"Create bucket"**
3. Nombre: `product-images`
4. Marca como **"Public bucket"** ✅
5. Haz clic en **"Create bucket"**
6. Ya puedes subir imágenes desde la app al crear productos

---

## ❌ Solución de Problemas

### "npm: command not found"
- **Problema**: No tienes Node.js instalado
- **Solución**: Descarga e instala desde https://nodejs.org (versión LTS)

### Error al ejecutar la migración
- **Problema**: Ya ejecutaste partes de la migración antes
- **Solución**: El script usa `IF NOT EXISTS`, no debería dar error. Si da error específico, compártelo.

### No puedo iniciar sesión
- **Problema**: El usuario no tiene rol asignado
- **Solución**: Verifica que ejecutaste el PASO 2B correctamente. El email y el ID deben coincidir.

### "Error connecting to database"
- **Problema**: Credenciales incorrectas en `.env`
- **Solución**: Verifica que el archivo `.env` tiene las credenciales correctas:
```env
VITE_SUPABASE_URL=https://zeqootmdlfpospbwwzuh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_cykng2t8Twn7bf61oc12rQ_H25Qn2d0
```

---

## 🎨 Personalización

### Cambiar colores del tema
- Archivo: `src/contexts/ThemeContext.tsx`
- Tema por defecto: **"fashion"** (rosa/morado)
- Otros temas disponibles: amber, blue, green, dark

### Cambiar logo
- Archivos:
  - `public/fashion-icon.svg` (logo principal)
  - `public/favicon.svg` (favicon)

### Cambiar nombre de la app
- Archivo: `index.html` (línea 14)
- Archivos: `src/components/Navigation.tsx` y `src/components/LoginForm.tsx`

---

## 📚 Recursos

- **Documentación Supabase**: https://supabase.com/docs
- **Documentación React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa la sección **"Solución de Problemas"** arriba
2. Verifica que seguiste todos los pasos en orden
3. Comprueba que las credenciales en `.env` son correctas
4. Asegúrate de haber ejecutado la migración completa

---

## ✅ Checklist Final

Antes de empezar a usar la app, verifica:

- [ ] Ejecuté `MIGRACION_COMPLETA_TIENDA_ROPA.sql` en Supabase
- [ ] Creé mi usuario en Authentication
- [ ] Asigné el rol super_admin a mi usuario
- [ ] Ejecuté `npm install` sin errores
- [ ] La app se ejecuta con `npm run dev`
- [ ] Puedo iniciar sesión con mi usuario
- [ ] Tengo acceso a todas las secciones como Super Admin

¡Si marcaste todo, estás listo para usar LIN-Fashion! 🎉
