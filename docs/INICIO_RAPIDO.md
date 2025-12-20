# Inicio Rápido - Tienda de Ropa

## Tu aplicación está lista para comenzar

Ya se ha creado la copia de la aplicación de cafetería y está lista para ser modificada para una tienda de ropa.

## Ubicaciones

- **Aplicación Original (Cafetería):** `C:\Users\Admin\Desktop\Coffe\Coffe`
- **Nueva Aplicación (Ropa):** `C:\Users\Admin\Desktop\ClothingStore`

## Lo que ya está hecho

✅ Código copiado completamente (sin node_modules)
✅ package.json actualizado a "clothing-store"
✅ Título de la página actualizado a "LIN-Fashion"
✅ Nuevo repositorio Git inicializado
✅ Guía completa de migración creada
✅ Schema SQL de ejemplo para ropa creado

## Primeros Pasos

### 1. Instalar Dependencias
```bash
cd C:\Users\Admin\Desktop\ClothingStore
npm install
```

### 2. Configurar Supabase
Crea un nuevo proyecto en Supabase o usa uno diferente del de cafetería:

1. Ve a https://supabase.com
2. Crea un nuevo proyecto (o usa uno existente diferente)
3. Copia las credenciales

### 3. Configurar Variables de Entorno
Edita el archivo `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-key-aqui
```

### 4. Ejecutar Migraciones
En el panel de Supabase SQL Editor, ejecuta:
1. Primero las migraciones existentes en `supabase/migrations/`
2. Luego el schema nuevo en `EJEMPLO_SCHEMA_ROPA.sql`

### 5. Iniciar la Aplicación
```bash
npm run dev
```

La aplicación estará disponible en: http://localhost:5173

## Archivos Importantes

📖 **GUIA_MIGRACION_ROPA.md** - Guía completa con todos los cambios necesarios
🗄️ **EJEMPLO_SCHEMA_ROPA.sql** - Schema de base de datos para tienda de ropa
📝 **INICIO_RAPIDO.md** - Este archivo

## Próximos Cambios Recomendados

### Prioridad Alta
1. **Modificar ProductsManager.tsx** - Agregar campos de talla, color, género
2. **Actualizar categorías** - Cambiar de cafetería a ropa
3. **Modificar POS.tsx** - Selector de variantes (talla + color)

### Prioridad Media
4. **Decidir sobre sistema de mesas** - ¿Eliminar o convertir en "Vendedores"?
5. **Actualizar Analytics.tsx** - Reportes específicos de ropa
6. **Cambiar iconos y colores** - Branding de tienda de ropa

### Prioridad Baja
7. **Sistema de cambios/devoluciones**
8. **Gestión de clientes**
9. **Etiquetas con código de barras**

## Estructura del Proyecto

```
ClothingStore/
├── src/
│   ├── components/          # Componentes React
│   │   ├── ProductsManager.tsx    ⭐ Modificar para ropa
│   │   ├── POS.tsx                ⭐ Agregar selector de variantes
│   │   ├── CategoryManager.tsx    ⭐ Actualizar categorías
│   │   ├── Analytics.tsx          ⭐ Reportes de ropa
│   │   ├── Sala.tsx               ❓ Decidir si mantener
│   │   └── TableManager.tsx       ❓ Decidir si mantener
│   ├── contexts/            # Contextos (Auth, Cart, Theme, etc.)
│   ├── lib/                 # Utilidades y Supabase
│   └── types/               # Tipos TypeScript
├── supabase/
│   └── migrations/          # Migraciones de base de datos
├── public/                  # Archivos estáticos
├── .env                     # Variables de entorno (no en Git)
├── package.json
└── GUIA_MIGRACION_ROPA.md  # 📖 Lee esto para detalles completos
```

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Verificar tipos TypeScript
npm run typecheck

# Lint del código
npm run lint

# Ver commits
git log --oneline

# Crear un nuevo commit
git add .
git commit -m "Descripción de los cambios"

# Ver cambios sin commit
git status
git diff
```

## Notas Importantes

⚠️ **NO MODIFIQUES** la aplicación original en `C:\Users\Admin\Desktop\Coffe\Coffe`

✅ **HAZ COMMITS FRECUENTES** en la nueva aplicación para poder revertir cambios

📚 **LEE LA GUÍA COMPLETA** en `GUIA_MIGRACION_ROPA.md` antes de hacer cambios grandes

## Diferencias Clave: Cafetería vs Tienda de Ropa

| Concepto | Cafetería | Tienda de Ropa |
|----------|-----------|----------------|
| Productos | Bebidas, comidas | Prendas de vestir |
| Variantes | Tamaño (S/M/L bebida) | Talla + Color |
| Inventario | Por producto | Por variante |
| Sistema de Mesas | Sí (importante) | No (opcional: vendedores) |
| Categorías | Bebidas, postres | Camisetas, pantalones, etc. |
| Devoluciones | Raro | Común (cambio talla) |
| Clientes | Anónimos | Programa fidelización |

## ¿Necesitas Ayuda?

1. **Errores de TypeScript**: Ejecuta `npm run typecheck`
2. **Errores de Base de Datos**: Verifica que las migraciones se ejecutaron correctamente
3. **Errores de Compilación**: Revisa la consola del navegador (F12)
4. **La app no arranca**: Verifica que node_modules esté instalado

## Siguientes Pasos Sugeridos

1. ✅ Instalar dependencias (`npm install`)
2. ✅ Configurar Supabase y `.env`
3. ✅ Ejecutar migraciones
4. ✅ Iniciar la app (`npm run dev`)
5. 📝 Leer `GUIA_MIGRACION_ROPA.md` completo
6. 🔧 Comenzar con los cambios de Prioridad Alta
7. 🧪 Probar cada cambio antes de continuar
8. 💾 Hacer commits frecuentes

## Checklist de Verificación

Antes de comenzar a modificar, verifica:

- [ ] Node.js instalado (v18+)
- [ ] npm funcionando
- [ ] Cuenta de Supabase creada
- [ ] Nuevo proyecto Supabase configurado
- [ ] Archivo .env creado con las credenciales
- [ ] Leí la guía de migración
- [ ] Entiendo la estructura del proyecto

¡Buena suerte con tu tienda de ropa! 🛍️👕👗
