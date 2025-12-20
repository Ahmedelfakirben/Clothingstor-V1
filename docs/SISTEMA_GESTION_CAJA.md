# Sistema de Gestión de Caja Mejorado

## 📊 Resumen
Se ha implementado un sistema de gestión de caja **lógico y coherente** que refleja la realidad del flujo de efectivo durante el día.

## 🎯 Problema Anterior
El sistema antiguo solo comparaba:
- Apertura vs Cierre
- No consideraba las ventas reales
- No consideraba los retiros de dinero

**Ejemplo del problema:**
- Apertura: €100
- Ventas del día: €500
- Se retiraron €200 para depositar en el banco
- Cierre real: €400

❌ **Sistema antiguo**: Balance = €400 - €100 = **€300** ✅ (incorrecto, debería ser €0)

## ✅ Solución Implementada

### Fórmula Lógica:
```
Cierre Esperado = Apertura + Ventas - Retiros
Diferencia = Cierre Real - Cierre Esperado
```

**Mismo ejemplo con el nuevo sistema:**
- Apertura: €100
- Ventas: €500
- Retiros: €200
- **Cierre Esperado**: €100 + €500 - €200 = **€400**
- Cierre Real: €400
- **Diferencia**: €400 - €400 = **€0** ✅ (correcto, cuadra perfecto)

## 🗄️ Base de Datos

### Nueva Tabla: `cash_withdrawals`
```sql
CREATE TABLE cash_withdrawals (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES cash_register_sessions,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  withdrawn_by UUID REFERENCES employee_profiles,
  withdrawn_at TIMESTAMP,
  notes TEXT
);
```

**Archivo de migración:** `create_cash_withdrawals.sql`

## 📋 Pasos de Implementación

### 1. Ejecutar Script SQL
```bash
# Ejecuta el archivo create_cash_withdrawals.sql en Supabase SQL Editor
```

Este script:
- Crea la tabla `cash_withdrawals`
- Configura RLS (solo admin/super_admin pueden crear retiros)
- Habilita Realtime para actualizaciones en vivo
- Agrega índices para mejorar rendimiento

### 2. Verificar Permisos
El sistema automáticamente:
- ✅ Admin y Super Admin pueden registrar retiros
- ✅ Todos pueden ver retiros
- ❌ Cajeros NO pueden registrar retiros

## 🎨 Interfaz de Usuario

### Dashboard de Caja - Nueva Vista

La tabla ahora muestra:

| Empleado | Fecha | Apertura | Ventas | Retiros | Cierre Esperado | Cierre Real | Diferencia | Acciones |
|----------|-------|----------|--------|---------|-----------------|-------------|------------|----------|
| Juan | 21/01 | €100 | €500 | €200 | €400 | €400 | €0 | 🖨️ Retiro |

**Colores de la Diferencia:**
- 🟢 Verde: Diferencia = €0 (cuadra perfecto)
- 🔵 Azul: Diferencia > €0 (sobrante de dinero)
- 🔴 Rojo: Diferencia < €0 (faltante de dinero)

### Botón "Retiro"
Solo visible para **Admin y Super Admin**.

Al hacer clic:
1. Abre modal de registro de retiro
2. Campos:
   - **Monto** (requerido)
   - **Motivo** (requerido): Depósito bancario, Pago a proveedor, Gastos operativos, Cambio de billetes, Otros
   - **Notas** (opcional)
3. Al guardar, se actualiza automáticamente el cierre esperado

## 📊 Cálculos Automáticos

El sistema calcula automáticamente para cada día:

### 1. Ventas del Día
```typescript
const { data: orders } = await supabase
  .from('orders')
  .select('total')
  .eq('employee_id', employeeId)
  .eq('status', 'completed')  // Solo pedidos completados
  .gte('created_at', startOfDay)
  .lte('created_at', endOfDay);

totalSales = sum(orders.total);
```

### 2. Retiros del Día
```typescript
const { data: withdrawals } = await supabase
  .from('cash_withdrawals')
  .select('amount')
  .in('session_id', sessionIds);

totalWithdrawals = sum(withdrawals.amount);
```

### 3. Cierre Esperado
```typescript
expectedClosing = totalOpening + totalSales - totalWithdrawals;
```

### 4. Diferencia
```typescript
difference = totalClosing - expectedClosing;
```

## 🔍 Casos de Uso

### Caso 1: Día Normal (Sin Retiros)
- Apertura: €100
- Ventas: €300
- Retiros: €0
- **Cierre Esperado**: €100 + €300 - €0 = **€400**
- Cierre Real: €400
- **Diferencia**: €0 ✅

### Caso 2: Con Depósito Bancario
- Apertura: €100
- Ventas: €800
- Retiros: €500 (depósito bancario)
- **Cierre Esperado**: €100 + €800 - €500 = **€400**
- Cierre Real: €400
- **Diferencia**: €0 ✅

### Caso 3: Error de Conteo (Faltante)
- Apertura: €100
- Ventas: €300
- Retiros: €0
- **Cierre Esperado**: €400
- Cierre Real: €380 (cajero contó mal o falta dinero)
- **Diferencia**: -€20 🔴 (FALTANTE)

### Caso 4: Error de Conteo (Sobrante)
- Apertura: €100
- Ventas: €300
- Retiros: €0
- **Cierre Esperado**: €400
- Cierre Real: €420 (cajero contó mal o hay dinero de más)
- **Diferencia**: +€20 🔵 (SOBRANTE)

## 📝 Reportes

Los reportes diarios ahora incluyen:
- ✅ Total de Ventas (pedidos confirmados)
- ✅ Total de Retiros
- ✅ Cierre Esperado calculado
- ✅ Diferencia real vs esperado

Esto permite detectar:
- Errores de conteo
- Dinero faltante/sobrante
- Validar que el flujo de caja sea coherente

## 🌍 Traducciones

Sistema completamente traducido:
- ✅ Español
- ✅ Francés

**Nuevas traducciones agregadas:**
- Apertura / Ouverture
- Ventas / Ventes
- Retiros / Retraits
- Cierre Esperado / Fermeture Prévue
- Cierre Real / Fermeture Réelle
- Diferencia / Différence
- Registrar Retiro de Caja / Enregistrer un Retrait de Caisse

## 🔐 Seguridad

### Row Level Security (RLS)
```sql
-- Ver retiros: todos los usuarios autenticados
CREATE POLICY "view_withdrawals" ON cash_withdrawals FOR SELECT TO authenticated USING (true);

-- Crear retiros: solo admin y super_admin
CREATE POLICY "insert_withdrawals" ON cash_withdrawals FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
```

## 📂 Archivos Modificados

### Nuevos Archivos
1. **[create_cash_withdrawals.sql](create_cash_withdrawals.sql)** - Script de migración de base de datos

### Archivos Modificados
1. **[CashRegisterDashboard.tsx](src/components/CashRegisterDashboard.tsx)**
   - Interfaz `CashWithdrawal` agregada (línea 20-28)
   - Estados para retiros agregados (línea 71-76)
   - Función `fetchWithdrawals()` (línea 183-195)
   - Función `registerWithdrawal()` (línea 197-230)
   - Función `groupSessionsByDay()` mejorada con cálculos (línea 273-350)
   - Tabla actualizada con nuevas columnas (línea 954-974)
   - Celdas de tabla con nueva lógica (línea 992-1037)
   - Modal de registro de retiros (línea 1047-1131)

2. **[LanguageContext.tsx](src/contexts/LanguageContext.tsx)**
   - Traducciones ES agregadas (línea 462-488)
   - Traducciones FR agregadas (línea 860-886)

## ✅ Beneficios

1. **Coherencia Matemática**: Los números siempre cuadran lógicamente
2. **Trazabilidad**: Registro de todos los retiros con motivo y responsable
3. **Detección de Errores**: Fácil identificar faltantes/sobrantes
4. **Transparencia**: Admin puede ver exactamente qué pasó con el dinero
5. **Reportes Precisos**: Documentación completa del flujo de efectivo

## 🚀 Próximos Pasos

1. **Ejecutar el script SQL** en Supabase
2. **Probar el sistema** con casos reales
3. **Capacitar al equipo** sobre:
   - Cuándo registrar retiros
   - Cómo interpretar las diferencias
   - Importancia de contar correctamente al cierre

## 📞 Soporte

Si tienes dudas sobre:
- Cómo registrar un retiro
- Por qué aparece una diferencia
- Cómo interpretar los reportes

Consulta este documento o contacta al administrador del sistema.

---

✨ **Sistema implementado y listo para usar** ✨
