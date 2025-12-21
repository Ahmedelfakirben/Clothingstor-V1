-- ====================================
-- MIGRACIÓN COMPLETA CONSOLIDADA - TIENDA DE ROPA
-- ====================================
-- Este archivo contiene todas las migraciones necesarias para la tienda de ropa
-- Consolida migraciones anteriores y nuevas tablas (withdrawals, stock).
-- Fecha: 2025-12-21
-- ====================================

-- ====================================
-- PASO 1: EXTENSIONES
-- ====================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ====================================
-- PASO 2: TABLAS PRINCIPALES
-- ====================================

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  base_price decimal(10,2) NOT NULL,
  image_url text DEFAULT '',
  available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  -- Campos específicos de Ropa
  brand text,
  material text,
  gender text CHECK (gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña')),
  season text CHECK (season IN ('primavera', 'verano', 'otoño', 'invierno', 'todas')),
  stock integer DEFAULT 0
);

COMMENT ON COLUMN products.brand IS 'Marca de la prenda (Zara, H&M, Nike, etc.)';
COMMENT ON COLUMN products.material IS 'Material de la prenda (algodón, poliéster, lana, etc.)';
COMMENT ON COLUMN products.gender IS 'Género al que está dirigida la prenda';
COMMENT ON COLUMN products.season IS 'Temporada recomendada para la prenda';
COMMENT ON COLUMN products.stock IS 'Cantidad disponible en inventario';

-- Tabla de tamaños de producto
CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_name text NOT NULL,
  price_modifier decimal(10,2) DEFAULT 0,
  stock INTEGER DEFAULT 0, -- Agregado para control de stock por talla
  created_at timestamptz DEFAULT now()
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  loyalty_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabla de mesas (opcional, heredado, pero mantenemos por compatibilidad)
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  seats integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','dirty')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'preparing' CHECK (status IN ('preparing', 'completed', 'cancelled')),
  total decimal(10,2) DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash', 'card', 'digital')),
  order_number integer,
  service_type text NOT NULL DEFAULT 'takeaway' CHECK (service_type IN ('dine_in','takeaway')),
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de items de pedido
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id uuid REFERENCES product_sizes(id) ON DELETE SET NULL,
  quantity integer DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Tabla de perfiles de empleados
CREATE TABLE IF NOT EXISTS employee_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text DEFAULT 'cashier' CHECK (role IN ('super_admin', 'admin', 'cashier', 'barista', 'waiter')),
  phone text,
  email text,
  active boolean DEFAULT true,
  deleted_at timestamptz,
  is_online boolean DEFAULT false,
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tipo enum para categorías de gastos
DO $$ BEGIN
    CREATE TYPE public.expense_category AS ENUM ('supplier', 'salary', 'rent', 'utilities', 'maintenance', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de gastos
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  category expense_category NOT NULL,
  description text NOT NULL,
  amount decimal(10,2) NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  employee_id uuid REFERENCES auth.users(id),
  receipt_url text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de historial de pedidos
CREATE TABLE IF NOT EXISTS order_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'cancelled')),
  status TEXT NOT NULL CHECK (status IN ('preparing', 'completed', 'cancelled')),
  total DECIMAL(10,2) NOT NULL,
  items JSONB,
  employee_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('UTC'::text, now()) NOT NULL
);

-- Tabla de sesiones de caja registradora
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  opening_amount numeric(12,2) NOT NULL CHECK (opening_amount >= 0),
  opened_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  closing_amount numeric(12,2) NULL CHECK (closing_amount >= 0),
  closed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Tabla de retiros de caja (Nueva)
CREATE TABLE IF NOT EXISTS public.cash_withdrawals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    withdrawn_by UUID REFERENCES auth.users(id),
    withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de productos eliminados
CREATE TABLE IF NOT EXISTS deleted_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category_id uuid,
  base_price decimal(10,2) NOT NULL,
  image_url text DEFAULT '',
  deleted_at timestamptz DEFAULT now(),
  deleted_reason text DEFAULT 'Eliminado por usuario',
  created_at timestamptz DEFAULT now()
);

-- Tabla de pedidos eliminados
CREATE TABLE IF NOT EXISTS deleted_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_number INTEGER,
  total DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  deleted_by UUID REFERENCES employee_profiles(id) NOT NULL,
  deletion_note TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  section VARCHAR(100) NOT NULL,
  page_id VARCHAR(100) NOT NULL,
  can_access BOOLEAN DEFAULT true,
  can_confirm_order BOOLEAN DEFAULT true,
  can_validate_order BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, section, page_id)
);

-- Tabla de configuración de la empresa
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'Tienda de Ropa',
  address TEXT,
  phone VARCHAR(50),
  language VARCHAR(2) DEFAULT 'es' CHECK (language IN ('es', 'fr', 'en')),
  theme VARCHAR(20) DEFAULT 'fashion' CHECK (theme IN ('amber', 'dark', 'blue', 'green', 'fashion')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de configuración de divisa
CREATE TABLE IF NOT EXISTS app_currency_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'EUR',
  currency_symbol VARCHAR(5) NOT NULL DEFAULT '€',
  currency_name VARCHAR(50) NOT NULL DEFAULT 'Euro',
  decimal_places INTEGER NOT NULL DEFAULT 2,
  position VARCHAR(10) NOT NULL DEFAULT 'after' CHECK (position IN ('before', 'after')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de divisas disponibles
CREATE TABLE IF NOT EXISTS available_currencies (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(5) NOT NULL,
  name VARCHAR(50) NOT NULL,
  decimal_places INTEGER DEFAULT 2,
  symbol_position VARCHAR(10) DEFAULT 'after'
);

-- Tabla de historial de backups
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  backup_type VARCHAR(20) CHECK (backup_type IN ('manual', 'automatic')) DEFAULT 'manual',
  size_mb DECIMAL(10,2) NOT NULL,
  tables_included TEXT[] NOT NULL,
  status VARCHAR(20) CHECK (status IN ('completed', 'failed')) DEFAULT 'completed',
  notes TEXT,
  s3_url TEXT,
  file_name VARCHAR(255)
);

-- Tabla de configuración de backups
CREATE TABLE IF NOT EXISTS backup_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tables TEXT[] NOT NULL DEFAULT ARRAY[
    'products', 'categories', 'orders', 'order_items', 'employee_profiles',
    'cash_register_sessions', 'role_permissions', 'company_settings', 'tables'
  ],
  s3_enabled BOOLEAN DEFAULT true,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_time VARCHAR(5) DEFAULT '02:00',
  schedule_frequency VARCHAR(20) DEFAULT 'daily' CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly')),
  retention_days INTEGER DEFAULT 30,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ====================================
-- PASO 3: ÍNDICES
-- ====================================

-- products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_season ON products(season);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- product_sizes
CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- order_history
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at);

-- employee_profiles
CREATE INDEX IF NOT EXISTS idx_employee_profiles_deleted_at ON employee_profiles(deleted_at);

-- tables
CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);

-- cash_register_sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_employee ON public.cash_register_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON public.cash_register_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_at ON public.cash_register_sessions(closed_at DESC);

-- deleted_products
CREATE INDEX IF NOT EXISTS idx_deleted_products_original_id ON deleted_products(original_id);
CREATE INDEX IF NOT EXISTS idx_deleted_products_deleted_at ON deleted_products(deleted_at DESC);

-- deleted_orders
CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_at ON deleted_orders(deleted_at);

-- role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page_id);

-- company_settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_singleton ON company_settings ((true));


-- ====================================
-- PASO 4: FUNCIONES Y TRIGGERS
-- ====================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de pedido
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS integer AS $$
DECLARE
  today_start timestamptz;
  next_number integer;
BEGIN
  today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT COALESCE(MAX(order_number), 0) INTO next_number
  FROM orders
  WHERE created_at >= today_start;
  RETURN next_number + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar cambios en pedidos (historial)
CREATE OR REPLACE FUNCTION public.handle_order_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_history (
      order_id, action, status, total, items, employee_id, created_at
    ) VALUES (
      NEW.id, 'created', NEW.status, NEW.total,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'size_id', oi.size_id
          )
        )
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
      ),
      NEW.employee_id, NEW.created_at
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.order_history (
      order_id, action, status, total, items, employee_id, created_at
    ) VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'completed' THEN 'completed'
        WHEN NEW.status = 'cancelled' THEN 'cancelled'
        ELSE 'updated'
      END,
      NEW.status, NEW.total,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'size_id', oi.size_id
          )
        )
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
      ),
      NEW.employee_id, NOW()
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Funciones para updated_at específicas (si se requiere nombre distinto, o reusar la genérica)
-- Reusaremos update_updated_at_column para simplicidad donde sea posible

-- Triggers
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER handle_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER orders_audit_trigger AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_order_change();
CREATE TRIGGER assign_order_number_trigger BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION assign_order_number();

-- ====================================
-- PASO 5: POLÍTICAS RLS (Row Level Security)
-- ====================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_currency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_config ENABLE ROW LEVEL SECURITY;

-- Políticas Consolidadas (Ejemplos clave, se asume que se ejecutarán las detalladas si es necesario,
-- aquí ponemos las esenciales para funcionamiento 'permissive' o standard)

-- Categories/Products: View All, Edit Admin
CREATE POLICY "View Products All" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Products Admin" ON products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "View Categories All" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Categories Admin" ON categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Orders: Employees view/create
CREATE POLICY "Employees View Orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees Create Orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Employees Update Orders" ON orders FOR UPDATE TO authenticated USING (true);

-- Cash Sessions
CREATE POLICY "Cash Sessions View" ON cash_register_sessions FOR SELECT TO authenticated USING (
  employee_id = auth.uid() OR EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Cash Sessions Insert" ON cash_register_sessions FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Cash Sessions Update" ON cash_register_sessions FOR UPDATE TO authenticated USING (
  employee_id = auth.uid() OR EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Withdrawals
CREATE POLICY "Withdrawals Read/Write" ON public.cash_withdrawals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee Profiles
CREATE POLICY "View Profiles" ON employee_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update Self" ON employee_profiles FOR UPDATE TO authenticated USING (id = auth.uid());


-- ====================================
-- PASO 6: DATOS INICIALES (SEED)
-- ====================================

-- Configuración empresa
INSERT INTO company_settings (company_name, address, phone, theme)
VALUES ('Tienda de Ropa', 'Calle Principal #123', '+34 000 000 000', 'fashion')
ON CONFLICT DO NOTHING;

-- Configuración divisa
INSERT INTO app_currency_settings (currency_code, currency_symbol)
VALUES ('EUR', '€')
ON CONFLICT DO NOTHING;
