# 📦 Guía: Configurar Storage para Imágenes de Productos

## ⚠️ El problema
Error: **"Bucket not found"** al intentar subir imágenes de productos.

## ✅ Solución paso a paso

### Paso 1: Acceder al Storage de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. En el menú lateral izquierdo, haz clic en **"Storage"** (icono de carpeta)

### Paso 2: Crear el Bucket

1. Haz clic en el botón **"New bucket"** o **"Create bucket"**
2. Rellena los campos:
   - **Name:** `product-images` (exactamente así, sin espacios)
   - **Public bucket:** ✅ **ACTIVA** esta opción (muy importante)
   - **File size limit:** Deja el valor por defecto (50 MB está bien)
3. Haz clic en **"Create bucket"**

### Paso 3: Configurar las Políticas de Seguridad

Ahora necesitas crear las políticas RLS para el bucket:

#### Opción A: Desde la interfaz de Storage (Recomendado)

1. En **Storage**, haz clic en el bucket `product-images` que acabas de crear
2. Ve a la pestaña **"Policies"**
3. Haz clic en **"New policy"**

**Crear 4 políticas:**

#### Política 1: Lectura pública
```
Name: Public Access
Operation: SELECT
Target roles: public
Policy definition: true
```

#### Política 2: Subida para autenticados
```
Name: Authenticated users can upload
Operation: INSERT
Target roles: authenticated
Policy definition: bucket_id = 'product-images'
```

#### Política 3: Actualización para autenticados
```
Name: Authenticated users can update
Operation: UPDATE
Target roles: authenticated
Policy definition: bucket_id = 'product-images'
```

#### Política 4: Eliminación solo para admins
```
Name: Admins can delete
Operation: DELETE
Target roles: authenticated
Policy definition:
(bucket_id = 'product-images')
AND EXISTS (
  SELECT 1 FROM employee_profiles
  WHERE employee_profiles.id = auth.uid()
  AND employee_profiles.role IN ('admin', 'super_admin')
)
```

#### Opción B: Desde SQL Editor (Más rápido)

1. Ve a **SQL Editor** en el menú lateral
2. Copia y pega el contenido del archivo `CONFIGURAR_STORAGE_IMAGENES.sql`
3. Ejecuta el script

### Paso 4: Verificar la configuración

1. Ve a **Storage** → `product-images`
2. Verifica que el bucket tiene:
   - ✅ Icono de "público" (candado abierto)
   - ✅ Al menos 3-4 políticas activas

### Paso 5: Probar la carga de imágenes

1. Recarga tu aplicación
2. Ve a **Gestión de Productos**
3. Intenta crear un nuevo producto **con una imagen**
4. La imagen debería subirse correctamente

## 🎯 Resultado esperado

Después de configurar todo correctamente:
- ✅ Los productos se crean sin errores
- ✅ Las imágenes se suben al bucket `product-images`
- ✅ Las imágenes son visibles en la aplicación
- ✅ Las URLs de las imágenes son públicas

## ⚠️ Problemas comunes

### Error: "new row violates policy"
**Solución:** Asegúrate de que las políticas de INSERT y UPDATE estén activas.

### Error: "Unable to get public URL"
**Solución:** El bucket debe estar marcado como **público**. Ve a Settings del bucket y activa "Public bucket".

### Las imágenes no se ven
**Solución:** Verifica que la política de SELECT (lectura) esté activa para el rol `public`.

## 📞 ¿Necesitas ayuda?

Si después de seguir estos pasos sigues teniendo problemas:
1. Comparte el error exacto de la consola del navegador (F12)
2. Verifica que el bucket se llame exactamente `product-images`
3. Verifica que el bucket esté marcado como público
