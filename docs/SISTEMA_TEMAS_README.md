# Sistema de Temas - Configuración Centralizada

## ✅ Implementación Completada

He implementado un sistema de temas funcional y centralizado para toda la aplicación, similar al sistema de idiomas.

## 📋 Características

### 1. **4 Temas Disponibles**
- 🟠 **Tema Ámbar** (Actual) - Cálido y acogedor
- ⚫ **Tema Oscuro** - Elegante y profesional
- 🔵 **Tema Azul** - Fresco y confiable
- 🟢 **Tema Verde** - Natural y tranquilo

### 2. **Gestión Centralizada**
- ✅ Solo el **Super Administrador** puede cambiar el tema
- ✅ El cambio se aplica **automáticamente a todos los usuarios**
- ✅ **Sincronización en tiempo real** usando Supabase Realtime
- ✅ Los cambios persisten en la base de datos

### 3. **Arquitectura**
- **ThemeContext** - Context API de React para manejo global del tema
- **CSS Variables** - Variables CSS dinámicas que se actualizan según el tema seleccionado
- **Supabase Realtime** - Sincronización automática entre todos los usuarios conectados

## 🚀 Pasos para Activar el Sistema

### Paso 1: Ejecutar el Script SQL

**IMPORTANTE:** Debes ejecutar este script SQL en tu base de datos de Supabase:

```sql
-- Archivo: add_theme_to_company_settings.sql

-- Add theme column to company_settings table
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'amber';

-- Add check constraint for valid theme values
ALTER TABLE company_settings
ADD CONSTRAINT valid_theme CHECK (theme IN ('amber', 'dark', 'blue', 'green'));

-- Update existing record to have amber theme (default)
UPDATE company_settings
SET theme = 'amber'
WHERE theme IS NULL;
```

**Cómo ejecutar:**
1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `add_theme_to_company_settings.sql`
4. Haz clic en **Run**

### Paso 2: Verificar la Instalación

Después de ejecutar el SQL, el sistema debería funcionar automáticamente:

1. Inicia sesión como **Super Administrador**
2. Ve a **Sistema > Configuración**
3. Verás la sección **"Tema"** solo si eres super_admin
4. Selecciona cualquier tema y se aplicará inmediatamente

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:
1. **`src/contexts/ThemeContext.tsx`** - Context para manejo global de temas
2. **`add_theme_to_company_settings.sql`** - Script SQL para agregar columna theme
3. **`SISTEMA_TEMAS_README.md`** - Esta documentación

### Archivos Modificados:
1. **`src/App.tsx`** - Agregado ThemeProvider
2. **`src/components/AppSettings.tsx`** - Actualizado con selector de temas

## 🎨 Cómo Funciona

### Variables CSS Aplicadas

Cada tema define las siguientes variables CSS que se aplican automáticamente:

```css
--color-primary         /* Color principal */
--color-primary-hover   /* Hover del color principal */
--color-primary-light   /* Versión clara del color principal */
--color-primary-dark    /* Versión oscura del color principal */
--color-secondary       /* Color secundario */
--color-secondary-hover /* Hover del color secundario */
--color-accent          /* Color de acento */
```

### Colores por Tema

#### Tema Ámbar (Actual)
- Primary: #f59e0b (amber-500)
- Secondary: #f97316 (orange-500)
- Accent: #fb923c (orange-400)

#### Tema Oscuro
- Primary: #4b5563 (gray-600)
- Secondary: #6b7280 (gray-500)
- Accent: #9ca3af (gray-400)

#### Tema Azul
- Primary: #3b82f6 (blue-500)
- Secondary: #0ea5e9 (sky-500)
- Accent: #38bdf8 (sky-400)

#### Tema Verde
- Primary: #10b981 (emerald-500)
- Secondary: #14b8a6 (teal-500)
- Accent: #2dd4bf (teal-400)

## 🔧 Uso en Desarrollo

### Para Usar el Tema en Tus Componentes

Si quieres que un componente responda al tema actual, puedes usar el hook `useTheme`:

```typescript
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { currentTheme } = useTheme();

  return (
    <div data-theme={currentTheme}>
      {/* Tu contenido */}
    </div>
  );
}
```

### Para Usar las Variables CSS

En tus estilos de Tailwind, puedes usar las variables:

```typescript
<div style={{
  backgroundColor: 'var(--color-primary)',
  color: 'white'
}}>
  Contenido
</div>
```

## 📱 Sincronización en Tiempo Real

El sistema usa Supabase Realtime para sincronizar cambios:

1. El Super Admin cambia el tema en Sistema > Configuración
2. El tema se guarda en la tabla `company_settings`
3. Supabase Realtime notifica a **todos los usuarios conectados**
4. Cada cliente actualiza su tema automáticamente
5. **No es necesario recargar la página**

## 🛡️ Seguridad

- ✅ Solo el **Super Administrador** puede cambiar el tema
- ✅ La restricción se aplica tanto en el frontend como en la base de datos (RLS)
- ✅ Los cambios se registran en la base de datos
- ✅ No se permite guardar temas inválidos (constraint CHECK en SQL)

## ⚠️ Notas Importantes

1. **Ejecuta el SQL primero**: Sin ejecutar el script SQL, el sistema no funcionará
2. **Tema por defecto**: Si no hay tema configurado, se usa "amber"
3. **Sincronización**: Los cambios se aplican en tiempo real a todos los usuarios
4. **Persistencia**: El tema se guarda en la base de datos, no en localStorage

## 🐛 Solución de Problemas

### El selector de temas no aparece
- **Causa**: No estás logueado como super_admin
- **Solución**: Solo el super_admin puede ver y cambiar el tema

### Error al cambiar el tema
- **Causa**: No se ejecutó el script SQL
- **Solución**: Ejecuta `add_theme_to_company_settings.sql` en Supabase

### El tema no se aplica
- **Causa**: Posible error en la base de datos o Realtime
- **Solución**: Verifica la consola del navegador para errores

### El tema no se sincroniza
- **Causa**: Supabase Realtime podría no estar activo
- **Solución**: Verifica que Realtime esté habilitado en tu proyecto de Supabase

## 📞 Soporte

Si encuentras algún problema:
1. Verifica que ejecutaste el script SQL
2. Revisa la consola del navegador (F12) para errores
3. Verifica que el usuario sea super_admin
4. Comprueba que la columna `theme` existe en `company_settings`
