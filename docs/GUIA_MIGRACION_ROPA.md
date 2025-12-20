# Guía de Migración: De Cafetería a Tienda de Ropa

Esta guía te ayudará a adaptar el sistema POS de cafetería para una tienda de ropa.

## Estado Actual

Has creado una copia completa de la aplicación de cafetería en `C:\Users\Admin\Desktop\ClothingStore`. Los archivos básicos ya han sido actualizados:

- ✅ package.json: Renombrado a "clothing-store"
- ✅ index.html: Título actualizado a "LIN-Fashion"
- ✅ Git: Nuevo repositorio inicializado

## Cambios Necesarios por Prioridad

### 1. CRÍTICOS (Hacer primero)

#### 1.1 Base de Datos (Supabase)
Debes crear una nueva instancia de Supabase o usar un proyecto diferente:

```bash
# Actualizar el archivo .env
VITE_SUPABASE_URL=tu-nueva-url-supabase
VITE_SUPABASE_ANON_KEY=tu-nueva-key-supabase
```

**Importante:** Ejecuta las migraciones de base de datos desde `supabase/migrations/` para crear el esquema.

#### 1.2 Modelo de Productos
Modificar `src/components/ProductsManager.tsx` para productos de ropa:

**Campos a agregar:**
- Tallas (XS, S, M, L, XL, XXL)
- Colores
- Género (Hombre, Mujer, Unisex, Niños)
- Temporada (Primavera/Verano, Otoño/Invierno)
- Material (Algodón, Poliéster, etc.)
- Marca
- SKU por variante (talla + color)

**Campos a mantener:**
- Nombre
- Precio
- Categoría
- Proveedor
- Stock
- Imagen

#### 1.3 Categorías
Actualizar `src/components/CategoryManager.tsx` con categorías de ropa:
- Camisetas
- Pantalones
- Vestidos
- Chaquetas
- Accesorios
- Calzado
- Ropa Interior
- Deportiva

### 2. IMPORTANTES (Hacer después)

#### 2.1 Sistema de Inventario
Modificar para manejar variantes (talla + color):
- Stock por variante
- Alertas de stock bajo por variante
- Traspaso entre sucursales por variante

#### 2.2 POS (Punto de Venta)
Actualizar `src/components/POS.tsx`:
- Selector de talla y color al agregar producto
- Búsqueda por SKU/código de barras
- Vista de variantes disponibles
- Descuentos y promociones

#### 2.3 Sistema de Mesas
**DECISIÓN:** ¿Quieres mantener el sistema de mesas/salas?
- **Opción A:** Eliminarlo (tiendas de ropa no usan mesas)
- **Opción B:** Convertirlo en "Zonas de tienda" o "Vendedores"

Archivos a modificar/eliminar:
- `src/components/Sala.tsx`
- `src/components/TableManager.tsx`

#### 2.4 Reportes y Analytics
Actualizar `src/components/Analytics.tsx`:
- Ventas por categoría de ropa
- Productos más vendidos (por talla/color)
- Rotación de inventario
- Temporadas de mayor venta
- Análisis por género

### 3. OPCIONALES (Mejoras futuras)

#### 3.1 Cambios y Devoluciones
Agregar funcionalidad específica de tiendas de ropa:
- Cambio de talla
- Devoluciones con política de tiempo
- Notas de crédito

#### 3.2 Sistema de Etiquetas
- Generación de etiquetas con código de barras
- Etiquetas con precio por talla

#### 3.3 Proveedores
Adaptar `src/components/SupplierManager.tsx`:
- Catálogos de temporada
- Pedidos por colección
- Fechas de entrega de colecciones

#### 3.4 Clientes
Agregar funcionalidad de clientes:
- Programa de fidelización
- Historial de compras
- Tallas preferidas
- Notificaciones de nuevas colecciones

## Cambios Visuales

### Colores y Tema
Actualizar `src/contexts/ThemeContext.tsx` y `src/index.css`:
- Cambiar paleta de colores (café → colores de moda)
- Actualizar iconos (taza de café → percha/camisa)

### Iconos
Reemplazar en `public/`:
- `coffee-icon.svg` → `fashion-icon.svg` o `clothing-icon.svg`
- Actualizar referencias en `index.html`

### Logos y Branding
- Actualizar logo en `src/components/Navigation.tsx`
- Cambiar nombre "LIN-Caisse" por "LIN-Fashion" en toda la app

## Archivos de Configuración para Eliminar

Estos archivos son específicos de la versión de cafetería:
```bash
rm add_language_column.sql
rm add_online_status.sql
rm add_server_permission*.sql
rm add_theme_to_company_settings*.sql
rm SERVIDOR_README.md
```

## Plan de Implementación Sugerido

### Fase 1: Configuración Básica (1-2 días)
1. Configurar nueva base de datos Supabase
2. Actualizar .env
3. Probar que la app corre con `npm install && npm run dev`
4. Actualizar categorías a ropa

### Fase 2: Productos con Variantes (3-5 días)
1. Modificar esquema de base de datos para variantes
2. Actualizar ProductsManager con campos de ropa
3. Actualizar POS para seleccionar variantes
4. Probar creación y venta de productos

### Fase 3: Adaptar Funcionalidades (3-5 días)
1. Decidir sobre sistema de mesas (eliminar o adaptar)
2. Actualizar reportes y analytics
3. Modificar gestión de inventario
4. Actualizar visuales y branding

### Fase 4: Funcionalidades Específicas (1-2 semanas)
1. Sistema de cambios/devoluciones
2. Etiquetas con código de barras
3. Gestión de clientes
4. Optimizaciones

## Comandos Útiles

```bash
# Instalar dependencias
cd C:\Users\Admin\Desktop\ClothingStore
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build

# Ver errores de TypeScript
npm run typecheck
```

## Supabase: Nuevas Tablas Sugeridas

### Tabla: product_variants
```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  sku TEXT UNIQUE NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: clothing_attributes
```sql
CREATE TABLE clothing_attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  gender TEXT CHECK(gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña')),
  season TEXT CHECK(season IN ('primavera/verano', 'otoño/invierno', 'todo_el_año')),
  material TEXT,
  brand TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Recursos Adicionales

- **Supabase Docs:** https://supabase.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **React Icons (Lucide):** https://lucide.dev/

## Notas Importantes

1. **No toques la aplicación original** en `C:\Users\Admin\Desktop\Coffe\Coffe`
2. **Haz commits frecuentes** para poder revertir cambios si es necesario
3. **Prueba cada cambio** antes de continuar al siguiente
4. **Documenta** cualquier cambio importante que hagas

## Próximos Pasos

1. Instala las dependencias: `npm install`
2. Configura tu nueva base de datos Supabase
3. Actualiza el archivo `.env`
4. Comienza con los cambios críticos (sección 1)

Si tienes dudas sobre algún cambio específico, revisa el código actual antes de modificar.

## Contacto de Emergencia

Si algo sale mal, siempre puedes:
1. Ver el historial de git: `git log`
2. Revertir cambios: `git reset --hard HEAD`
3. Volver a copiar desde la versión original de cafetería
