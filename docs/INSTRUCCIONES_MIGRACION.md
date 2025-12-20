# Instrucciones para Ejecutar Migraciones en Supabase

## Paso 1: Acceder a tu Proyecto Supabase

1. Ve a https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto de tienda de ropa

## Paso 2: Ejecutar las Migraciones Básicas (OBLIGATORIO)

### 2.1 Abrir SQL Editor
- En el menú lateral izquierdo, haz clic en **"SQL Editor"**
- Haz clic en **"New Query"**

### 2.2 Ejecutar las migraciones de la cafetería (base del sistema)
Debes ejecutar las migraciones en este orden:

1. **Schema principal**:
   - Abre el archivo: `supabase/migrations/20251014105413_create_coffee_shop_schema.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **"Run"** (esquina inferior derecha)

2. **Proveedores y gastos**:
   - Abre: `supabase/migrations/20251014105414_add_suppliers_and_expenses.sql`
   - Copia y ejecuta

3. **Historial de órdenes**:
   - Abre: `supabase/migrations/20251014105414_create_order_history.sql`
   - Copia y ejecuta

4. **Actualización de categorías**:
   - Abre: `supabase/migrations/20251014105415_update_categories.sql`
   - Copia y ejecuta

5. **Sistema de órdenes**:
   - Abre: `supabase/migrations/20251014155000_update_orders_and_add_history.sql`
   - Copia y ejecuta

6. **Correcciones de triggers** (ejecuta cada uno en orden):
   - `20251015170000_fix_order_history_triggers.sql`
   - `20251015173000_order_history_rls_insert_policy.sql`
   - `20251015180000_add_tables_and_order_service.sql`
   - `20251015190500_seed_six_tables.sql`

7. **Sistema de empleados** (ejecuta cada uno):
   - `20251016100000_alter_employee_profiles_add_email_deleted_at.sql`
   - `20251016103000_employee_profiles_self_insert_policy.sql`
   - `20251016103100_employee_profiles_admin_insert_policy.sql`

8. **Caja registradora**:
   - `20251016120000_create_cash_register_sessions.sql`

9. **Numeración y eliminación**:
   - `20251018170000_add_order_numbering.sql`
   - `20251018180000_create_deleted_products_table.sql`
   - `20251018190000_fix_product_deletion_constraints.sql`

10. **Categorías y órdenes eliminadas**:
    - `20251019000000_add_updated_at_to_categories.sql`
    - `20251019010000_create_deleted_orders_table.sql`

11. **Roles y permisos** (ejecuta cada uno):
    - `20251019020000_add_new_roles_and_permissions.sql`
    - `20251019030000_update_role_constraint.sql`
    - `20251019040000_update_rls_for_super_admin.sql`
    - `20251019050000_fix_tables_policies.sql`
    - `20251019060000_fix_employee_profiles_self_access.sql`
    - `20251019070000_fix_recursion_employee_profiles.sql`
    - `20251019080000_add_granular_pos_permissions.sql`

12. **Configuración de empresa**:
    - `20251019090000_create_company_settings.sql`
    - `20251019100000_add_company_settings_permission.sql`
    - `20251019110000_fix_company_settings_policies.sql`

13. **Configuración de app**:
    - `20251020120000_add_app_settings_permission.sql`

## Paso 3: Agregar Columnas de Ropa a la Tabla Products (OBLIGATORIO)

Ejecuta este SQL en el editor:

```sql
-- Agregar columnas específicas de ropa a la tabla products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK(gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña')),
ADD COLUMN IF NOT EXISTS season TEXT CHECK(season IN ('primavera_verano', 'otoño_invierno', 'todo_el_año')),
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_season ON products(season);

-- Comentarios
COMMENT ON COLUMN products.brand IS 'Marca de la prenda (Nike, Adidas, etc.)';
COMMENT ON COLUMN products.material IS 'Material de la prenda (Algodón, Poliéster, etc.)';
COMMENT ON COLUMN products.gender IS 'Género de la prenda';
COMMENT ON COLUMN products.season IS 'Temporada de la prenda';
COMMENT ON COLUMN products.stock IS 'Stock disponible';
```

## Paso 4: Ejecutar Schema Completo de Ropa (OPCIONAL - Solo si quieres variantes)

**IMPORTANTE**: Este paso es opcional. Solo si quieres tener sistema de variantes (talla + color) con stock separado.

Si quieres el sistema completo de variantes:
1. Abre el archivo: `EJEMPLO_SCHEMA_ROPA.sql`
2. Copia todo el contenido
3. Pégalo en el SQL Editor
4. Haz clic en **"Run"**

Esto creará:
- Tabla de variantes (product_variants) con tallas y colores
- Tabla de atributos de ropa (clothing_attributes)
- Sistema de cambios y devoluciones
- Sistema de clientes
- Catálogos de tallas y colores
- Promociones

## Paso 5: Crear Usuario Super Admin (OBLIGATORIO)

Ejecuta este SQL reemplazando con tus datos:

```sql
-- 1. Primero crea el usuario en Authentication
-- Ve a Authentication > Users en Supabase Dashboard
-- Haz clic en "Add User" y crea un usuario con email y contraseña

-- 2. Luego ejecuta este SQL (reemplaza el email con el que creaste):
INSERT INTO employee_profiles (id, email, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'tu@email.com'),
  'tu@email.com',
  'Administrador',
  'super_admin'
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin';
```

## Paso 6: Configurar Storage para Imágenes (OPCIONAL)

Si quieres subir imágenes de productos:

1. Ve a **Storage** en el menú lateral
2. Haz clic en **"Create bucket"**
3. Nombre del bucket: `product-images`
4. Marca como **Público**
5. Haz clic en **"Create bucket"**

## Paso 7: Verificar que Todo Funciona

Ejecuta este query para verificar las tablas:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver al menos estas tablas:
- products
- categories
- orders
- order_items
- employee_profiles
- cash_register_sessions
- suppliers
- expenses
- role_permissions
- company_settings

## Problemas Comunes

### Error: "relation already exists"
- **Solución**: Esa migración ya se ejecutó, continúa con la siguiente.

### Error: "permission denied"
- **Solución**: Asegúrate de estar usando el proyecto correcto y que tienes permisos de admin.

### Error: "column already exists"
- **Solución**: Esa columna ya existe, puedes ignorar el error.

### Las imágenes no se suben
- **Solución**: Verifica que creaste el bucket "product-images" y que está marcado como público.

## ¿Qué Sigue?

Después de ejecutar las migraciones:

1. Instala las dependencias: `npm install`
2. Ejecuta la app: `npm run dev`
3. Inicia sesión con tu usuario super admin
4. Configura tu empresa en "Configuración de Empresa"
5. Agrega categorías de ropa (Camisetas, Pantalones, etc.)
6. Comienza a agregar productos

## Resumen de Comandos

```bash
# 1. Instalar dependencias
cd C:\Users\Admin\Desktop\ClothingStore
npm install

# 2. Ejecutar la aplicación en desarrollo
npm run dev

# 3. Abrir en navegador
# La app estará en http://localhost:5173
```

## Soporte

Si tienes problemas con las migraciones:
1. Revisa los errores en el SQL Editor
2. Verifica que ejecutaste las migraciones en orden
3. Asegúrate de estar usando las credenciales correctas en el archivo .env
