# 🌍 Instrucciones para Configurar el Sistema de Idioma Global

## ⚠️ Problema Actual
El idioma no se sincroniza entre usuarios. Cuando el super admin cambia el idioma, los demás usuarios no ven el cambio.

## 🔧 Solución Paso a Paso

### PASO 1: Habilitar Realtime en Supabase

1. **Ejecuta el script SQL** [enable_realtime.sql](enable_realtime.sql)
   - Ve a Supabase Dashboard → SQL Editor
   - Copia y pega TODO el contenido del archivo `enable_realtime.sql`
   - Ejecuta el script
   - **Verifica el resultado**: Deberías ver `company_settings` en la lista de tablas con Realtime habilitado

2. **Verificación Adicional en el Dashboard**:
   - Ve a: Database → Replication
   - Busca la tabla `company_settings`
   - Asegúrate de que el toggle esté **activado** (verde)

### PASO 2: Verificar que el Código Funciona

1. **Abre la consola del navegador** (F12)
2. **Inicia sesión como super_admin**
3. **Ve a Sistema → Configuración**
4. **Verifica los logs**:
   - Deberías ver logs que empiezan con `🔄 [LANGUAGE]`, `📡 [LANGUAGE]`, etc.
   - Busca específicamente: `📡 [LANGUAGE] Realtime subscription status: SUBSCRIBED`

### PASO 3: Probar el Cambio de Idioma

**Setup de prueba:**
1. Abre 2 navegadores diferentes (o modo incógnito + normal)
2. Inicia sesión en ambos:
   - Navegador 1: Super Admin
   - Navegador 2: Usuario normal (admin, cajero, etc.)

**Proceso de prueba:**
1. En **Navegador 1 (Super Admin)**:
   - Ve a Sistema → Configuración
   - Abre la **consola del navegador** (F12)
   - Cambia el idioma de Español → Français
   - Verifica los logs en la consola:
     ```
     🌍 [LANGUAGE] Attempting to change language to: fr
     📝 [LANGUAGE] Updating company_settings (ID: xxx) to language: fr
     ✅ [LANGUAGE] Language updated to fr in database
     ✅ [LANGUAGE] Language updated to fr in local state
     ```

2. En **Navegador 2 (Usuario normal)**:
   - Abre la **consola del navegador** (F12)
   - Espera unos segundos
   - Deberías ver:
     ```
     🔔 [LANGUAGE] Realtime change detected! {...}
     🌍 [LANGUAGE] Updating language to: fr (from Realtime)
     ✅ [LANGUAGE] Language updated successfully to: fr
     ```
   - **La interfaz debería cambiar automáticamente a francés**

### PASO 4: Diagnosticar Problemas

Si no funciona, revisa los logs en la consola:

#### ❌ Problema: No se actualiza en la base de datos
```
❌ [LANGUAGE] Error updating language in DB: {...}
```
**Solución**: Verifica las políticas RLS en Supabase
- Ve a Database → company_settings → Policies
- Asegúrate de que existe: "Allow super_admin to update company settings"

#### ❌ Problema: Realtime no está suscrito
```
📡 [LANGUAGE] Realtime subscription status: CHANNEL_ERROR
```
**Solución**:
1. Ejecuta nuevamente `enable_realtime.sql`
2. Verifica en Database → Replication que `company_settings` está habilitado
3. Reinicia la aplicación (Ctrl+R)

#### ❌ Problema: No recibe notificaciones de cambio
```
# No aparece este log cuando otro usuario cambia el idioma:
🔔 [LANGUAGE] Realtime change detected!
```
**Soluciones**:
1. Verifica que `REPLICA IDENTITY` está configurado:
   ```sql
   ALTER TABLE company_settings REPLICA IDENTITY FULL;
   ```
2. Verifica que la tabla está en la publicación:
   ```sql
   SELECT * FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
   AND tablename = 'company_settings';
   ```

### PASO 5: Verificación en Base de Datos

Ejecuta esta consulta en Supabase SQL Editor para verificar el estado actual:

```sql
-- Ver el idioma configurado actualmente
SELECT id, language, company_name
FROM company_settings;

-- Ver las políticas RLS
SELECT * FROM pg_policies
WHERE tablename = 'company_settings';

-- Ver si Realtime está habilitado
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'company_settings';
```

## 📊 Logs Esperados (Todo Correcto)

### Al iniciar la aplicación:
```
🔄 [LANGUAGE] Loading language from database...
✅ [LANGUAGE] Loaded language from DB: es
📡 [LANGUAGE] Setting up Realtime subscription...
📡 [LANGUAGE] Realtime subscription status: SUBSCRIBED
```

### Al cambiar el idioma (Super Admin):
```
🌍 [LANGUAGE] Attempting to change language to: fr
📝 [LANGUAGE] Updating company_settings (ID: xxx) to language: fr
✅ [LANGUAGE] Language updated to fr in database
✅ [LANGUAGE] Language updated to fr in local state
```

### Al recibir cambio (Otros usuarios):
```
🔔 [LANGUAGE] Realtime change detected! {new: {language: "fr", ...}}
🌍 [LANGUAGE] Updating language to: fr (from Realtime)
✅ [LANGUAGE] Language updated successfully to: fr
```

## 🆘 Si Nada Funciona

1. **Ejecuta estos 3 scripts en orden**:
   ```sql
   -- 1. enable_realtime.sql
   -- 2. Reinicia la app
   -- 3. Verifica los logs
   ```

2. **Verifica las credenciales de Supabase**:
   - Archivo: `src/lib/supabase.ts`
   - Asegúrate de que la URL y ANON KEY son correctos

3. **Reinicia todo**:
   - Cierra todos los navegadores
   - Ejecuta `npm run dev` nuevamente
   - Inicia sesión como super_admin
   - Verifica los logs en la consola

## ✅ Checklist Final

- [ ] Script `add_language_column.sql` ejecutado sin errores
- [ ] Script `enable_realtime.sql` ejecutado sin errores
- [ ] Realtime habilitado en Database → Replication → company_settings
- [ ] Al iniciar sesión, veo: `📡 [LANGUAGE] Realtime subscription status: SUBSCRIBED`
- [ ] Al cambiar idioma como super_admin, veo: `✅ [LANGUAGE] Language updated to X in database`
- [ ] En otro navegador, veo: `🔔 [LANGUAGE] Realtime change detected!`
- [ ] La interfaz cambia automáticamente en todos los navegadores

## 📞 Contacto

Si sigues teniendo problemas, envía los logs de la consola para poder ayudarte mejor.
