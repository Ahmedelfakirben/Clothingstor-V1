-- ====================================
-- MIGRACIÓN COMPLETA - TIENDA DE ROPA
-- ====================================
-- Este archivo contiene todas las migraciones necesarias para la tienda de ropa
-- Ejecutar TODO de una vez en Supabase SQL Editor
-- Fecha de creación: 2025-12-15
-- ====================================

-- ====================================
-- PASO 1: EXTENSIONES
-- ====================================
-- Habilitar extensiones necesarias para UUID y funciones avanzadas

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
  created_at timestamptz DEFAULT now()
);

-- Tabla de tamaños de producto
CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_name text NOT NULL,
  price_modifier decimal(10,2) DEFAULT 0,
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

-- Tabla de mesas (para restaurante/cafetería)
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
-- PASO 3: COLUMNAS ESPECÍFICAS DE ROPA
-- ====================================
-- Agregar columnas específicas para tienda de ropa en la tabla products

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS season text CHECK (season IN ('primavera', 'verano', 'otoño', 'invierno', 'todas'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;

COMMENT ON COLUMN products.brand IS 'Marca de la prenda (Zara, H&M, Nike, etc.)';
COMMENT ON COLUMN products.material IS 'Material de la prenda (algodón, poliéster, lana, etc.)';
COMMENT ON COLUMN products.gender IS 'Género al que está dirigida la prenda';
COMMENT ON COLUMN products.season IS 'Temporada recomendada para la prenda';
COMMENT ON COLUMN products.stock IS 'Cantidad disponible en inventario';


-- ====================================
-- PASO 4: ÍNDICES PARA RENDIMIENTO
-- ====================================

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_season ON products(season);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Índices para product_sizes
CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);

-- Índices para order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Índices para order_history
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at);

-- Índices para employee_profiles
CREATE INDEX IF NOT EXISTS idx_employee_profiles_deleted_at ON employee_profiles(deleted_at);

-- Índices para tables
CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);
CREATE INDEX IF NOT EXISTS idx_tables_name ON public.tables(name);

-- Índices para cash_register_sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_employee ON public.cash_register_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON public.cash_register_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_at ON public.cash_register_sessions(closed_at DESC);

-- Índices para deleted_products
CREATE INDEX IF NOT EXISTS idx_deleted_products_original_id ON deleted_products(original_id);
CREATE INDEX IF NOT EXISTS idx_deleted_products_deleted_at ON deleted_products(deleted_at DESC);

-- Índices para deleted_orders
CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_at ON deleted_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_by ON deleted_orders(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deleted_orders_order_id ON deleted_orders(order_id);

-- Índices para role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_pos_granular ON role_permissions(role, page_id, can_confirm_order, can_validate_order) WHERE page_id = 'pos';

-- Índices para backup_history
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_by ON backup_history(created_by);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_s3_url ON backup_history(s3_url) WHERE s3_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backup_history_backup_type_created ON backup_history(backup_type, created_at DESC);

-- Índice único para company_settings (solo un registro)
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_singleton ON company_settings ((true));


-- ====================================
-- PASO 5: FUNCIONES Y TRIGGERS
-- ====================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar updated_at (versión alternativa)
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

-- Función para asignar número de pedido
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

-- Función para actualizar updated_at en tables
CREATE OR REPLACE FUNCTION public.handle_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar updated_at en role_permissions
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar updated_at en company_settings
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar updated_at en currency_settings
CREATE OR REPLACE FUNCTION update_currency_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular próximo backup
CREATE OR REPLACE FUNCTION calculate_next_backup_time()
RETURNS TRIGGER AS $$
DECLARE
  next_time TIMESTAMP WITH TIME ZONE;
  schedule_hour INTEGER;
  schedule_minute INTEGER;
BEGIN
  schedule_hour := CAST(SPLIT_PART(NEW.schedule_time, ':', 1) AS INTEGER);
  schedule_minute := CAST(SPLIT_PART(NEW.schedule_time, ':', 2) AS INTEGER);

  CASE NEW.schedule_frequency
    WHEN 'daily' THEN
      next_time := (CURRENT_DATE + INTERVAL '1 day' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    WHEN 'weekly' THEN
      next_time := (CURRENT_DATE + INTERVAL '7 days' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    WHEN 'monthly' THEN
      next_time := (CURRENT_DATE + INTERVAL '1 month' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    ELSE
      next_time := NULL;
  END CASE;

  IF NEW.schedule_enabled THEN
    NEW.next_backup_at := next_time;
  ELSE
    NEW.next_backup_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar backups antiguos
CREATE OR REPLACE FUNCTION cleanup_old_backup_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM backup_history
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar backups antiguos automáticamente
CREATE OR REPLACE FUNCTION auto_cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_days INTEGER;
BEGIN
  SELECT bc.retention_days INTO retention_days
  FROM backup_config bc
  LIMIT 1;

  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;

  DELETE FROM backup_history
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para formatear moneda
CREATE OR REPLACE FUNCTION format_currency(amount NUMERIC)
RETURNS TEXT AS $$
DECLARE
  currency_rec RECORD;
  formatted TEXT;
BEGIN
  SELECT currency_code, currency_symbol, position
  INTO currency_rec
  FROM app_currency_settings
  LIMIT 1;

  formatted := TO_CHAR(amount, 'FM999,999,999,990.00');

  IF currency_rec.position = 'before' THEN
    RETURN currency_rec.currency_symbol || ' ' || formatted;
  ELSE
    RETURN formatted || ' ' || currency_rec.currency_symbol;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ====================================
-- PASO 6: TRIGGERS
-- ====================================

-- Trigger para orders updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para categories updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para suppliers updated_at
DROP TRIGGER IF EXISTS handle_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER handle_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para expenses updated_at
DROP TRIGGER IF EXISTS handle_expenses_updated_at ON public.expenses;
CREATE TRIGGER handle_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para order_history
DROP TRIGGER IF EXISTS orders_audit_trigger ON public.orders;
CREATE TRIGGER orders_audit_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_change();

-- Trigger para asignar número de pedido
DROP TRIGGER IF EXISTS assign_order_number_trigger ON orders;
CREATE TRIGGER assign_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_order_number();

-- Trigger para tables updated_at
DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;
CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tables_updated_at();

-- Trigger para cash_register_sessions updated_at
DROP TRIGGER IF EXISTS handle_cash_sessions_updated_at ON public.cash_register_sessions;
CREATE TRIGGER handle_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_register_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para role_permissions updated_at
DROP TRIGGER IF EXISTS update_role_permissions_updated_at_trigger ON role_permissions;
CREATE TRIGGER update_role_permissions_updated_at_trigger
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_permissions_updated_at();

-- Trigger para company_settings updated_at
DROP TRIGGER IF EXISTS update_company_settings_updated_at_trigger ON company_settings;
CREATE TRIGGER update_company_settings_updated_at_trigger
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Trigger para currency_settings updated_at
DROP TRIGGER IF EXISTS update_currency_settings_timestamp ON app_currency_settings;
CREATE TRIGGER update_currency_settings_timestamp
  BEFORE UPDATE ON app_currency_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_currency_settings_updated_at();

-- Trigger para backup_config
DROP TRIGGER IF EXISTS update_next_backup_time ON backup_config;
CREATE TRIGGER update_next_backup_time
  BEFORE INSERT OR UPDATE ON backup_config
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_backup_time();


-- ====================================
-- PASO 7: HABILITAR ROW LEVEL SECURITY (RLS)
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
ALTER TABLE deleted_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_currency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_config ENABLE ROW LEVEL SECURITY;


-- ====================================
-- PASO 8: POLÍTICAS RLS - CATEGORIES
-- ====================================

DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Categories are editable by admins only" ON categories;
CREATE POLICY "Categories are editable by admins only"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Categories are updatable by admins only" ON categories;
CREATE POLICY "Categories are updatable by admins only"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Categories are deletable by admins only" ON categories;
CREATE POLICY "Categories are deletable by admins only"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 9: POLÍTICAS RLS - PRODUCTS
-- ====================================

DROP POLICY IF EXISTS "Anyone can view products" ON products;
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin can insert products" ON products;
CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update products" ON products;
CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin can delete products" ON products;
CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 10: POLÍTICAS RLS - PRODUCT SIZES
-- ====================================

DROP POLICY IF EXISTS "Anyone can view product sizes" ON product_sizes;
CREATE POLICY "Anyone can view product sizes"
  ON product_sizes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage product sizes" ON product_sizes;
CREATE POLICY "Admins can manage product sizes"
  ON product_sizes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 11: POLÍTICAS RLS - CUSTOMERS
-- ====================================

DROP POLICY IF EXISTS "Employees can view customers" ON customers;
CREATE POLICY "Employees can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can create customers" ON customers;
CREATE POLICY "Employees can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can update customers" ON customers;
CREATE POLICY "Employees can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );


-- ====================================
-- PASO 12: POLÍTICAS RLS - ORDERS
-- ====================================

DROP POLICY IF EXISTS "Employees can view orders" ON orders;
CREATE POLICY "Employees can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can create orders" ON orders;
CREATE POLICY "Employees can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can update orders" ON orders;
CREATE POLICY "Employees can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );


-- ====================================
-- PASO 13: POLÍTICAS RLS - ORDER ITEMS
-- ====================================

DROP POLICY IF EXISTS "Employees can view order items" ON order_items;
CREATE POLICY "Employees can view order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can create order items" ON order_items;
CREATE POLICY "Employees can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can update order items" ON order_items;
CREATE POLICY "Employees can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can delete order items" ON order_items;
CREATE POLICY "Employees can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );


-- ====================================
-- PASO 14: POLÍTICAS RLS - EMPLOYEE PROFILES
-- ====================================

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON employee_profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON employee_profiles;
CREATE POLICY "Users can update own profile"
  ON employee_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON employee_profiles;
CREATE POLICY "Authenticated users can insert profiles"
  ON employee_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ====================================
-- PASO 15: POLÍTICAS RLS - SUPPLIERS
-- ====================================

DROP POLICY IF EXISTS "Suppliers are viewable by all users" ON suppliers;
CREATE POLICY "Suppliers are viewable by all users"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert suppliers" ON suppliers;
CREATE POLICY "Only admins can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can update suppliers" ON suppliers;
CREATE POLICY "Only admins can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete suppliers" ON suppliers;
CREATE POLICY "Only admins can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 16: POLÍTICAS RLS - EXPENSES
-- ====================================

DROP POLICY IF EXISTS "Expenses are viewable by admins only" ON expenses;
CREATE POLICY "Expenses are viewable by admins only"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can insert expenses" ON expenses;
CREATE POLICY "Only admins can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can update expenses" ON expenses;
CREATE POLICY "Only admins can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete expenses" ON expenses;
CREATE POLICY "Only admins can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 17: POLÍTICAS RLS - ORDER HISTORY
-- ====================================

DROP POLICY IF EXISTS "Employees can view order history" ON order_history;
CREATE POLICY "Employees can view order history"
  ON order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Employees can insert order history" ON order_history;
CREATE POLICY "Employees can insert order history"
  ON order_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );


-- ====================================
-- PASO 18: POLÍTICAS RLS - TABLES
-- ====================================

DROP POLICY IF EXISTS "Employees can view tables" ON tables;
CREATE POLICY "Employees can view tables"
  ON tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid() AND ep.active = true
    )
  );

DROP POLICY IF EXISTS "Employees can update tables" ON tables;
CREATE POLICY "Employees can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid() AND ep.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid() AND ep.active = true
    )
  );

DROP POLICY IF EXISTS "Super admins can insert tables" ON tables;
CREATE POLICY "Super admins can insert tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'super_admin'
      AND ep.active = true
      AND ep.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Super admins can delete tables" ON tables;
CREATE POLICY "Super admins can delete tables"
  ON tables FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'super_admin'
      AND ep.active = true
      AND ep.deleted_at IS NULL
    )
  );


-- ====================================
-- PASO 19: POLÍTICAS RLS - CASH REGISTER SESSIONS
-- ====================================

DROP POLICY IF EXISTS "Cash sessions viewable by owner or admins" ON cash_register_sessions;
CREATE POLICY "Cash sessions viewable by owner or admins"
  ON cash_register_sessions FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid() AND ep.role IN ('admin', 'super_admin') AND ep.active = true
    )
  );

DROP POLICY IF EXISTS "Cash sessions insertable by owner" ON cash_register_sessions;
CREATE POLICY "Cash sessions insertable by owner"
  ON cash_register_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid() AND status = 'open'
  );

DROP POLICY IF EXISTS "Cash sessions updatable by owner or admins" ON cash_register_sessions;
CREATE POLICY "Cash sessions updatable by owner or admins"
  ON cash_register_sessions FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid() AND ep.role IN ('admin', 'super_admin') AND ep.active = true
    )
  )
  WITH CHECK (
    status IN ('open','closed')
  );


-- ====================================
-- PASO 20: POLÍTICAS RLS - DELETED PRODUCTS
-- ====================================

DROP POLICY IF EXISTS "Employees can view deleted products" ON deleted_products;
CREATE POLICY "Employees can view deleted products"
  ON deleted_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage deleted products" ON deleted_products;
CREATE POLICY "Admins can manage deleted products"
  ON deleted_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 21: POLÍTICAS RLS - DELETED ORDERS
-- ====================================

DROP POLICY IF EXISTS "Empleados pueden ver pedidos eliminados" ON deleted_orders;
CREATE POLICY "Empleados pueden ver pedidos eliminados"
  ON deleted_orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin puede insertar pedidos eliminados" ON deleted_orders;
CREATE POLICY "Solo admin puede insertar pedidos eliminados"
  ON deleted_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );


-- ====================================
-- PASO 22: POLÍTICAS RLS - ROLE PERMISSIONS
-- ====================================

DROP POLICY IF EXISTS "Todos pueden ver permisos" ON role_permissions;
CREATE POLICY "Todos pueden ver permisos"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo super_admin puede modificar permisos" ON role_permissions;
CREATE POLICY "Solo super_admin puede modificar permisos"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );


-- ====================================
-- PASO 23: POLÍTICAS RLS - COMPANY SETTINGS
-- ====================================

DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admin can insert company settings" ON company_settings;
CREATE POLICY "Super admin can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin can update company settings" ON company_settings;
CREATE POLICY "Super admin can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin can delete company settings" ON company_settings;
CREATE POLICY "Super admin can delete company settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING (true);


-- ====================================
-- PASO 24: POLÍTICAS RLS - CURRENCY SETTINGS
-- ====================================

DROP POLICY IF EXISTS "Anyone can view currency settings" ON app_currency_settings;
CREATE POLICY "Anyone can view currency settings"
  ON app_currency_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins can update currency settings" ON app_currency_settings;
CREATE POLICY "Super admins can update currency settings"
  ON app_currency_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );


-- ====================================
-- PASO 25: POLÍTICAS RLS - AVAILABLE CURRENCIES
-- ====================================

DROP POLICY IF EXISTS "Anyone can view available currencies" ON available_currencies;
CREATE POLICY "Anyone can view available currencies"
  ON available_currencies FOR SELECT
  TO authenticated
  USING (true);


-- ====================================
-- PASO 26: POLÍTICAS RLS - BACKUP HISTORY
-- ====================================

DROP POLICY IF EXISTS "Super admins can view backup history" ON backup_history;
CREATE POLICY "Super admins can view backup history"
  ON backup_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Super admins can insert backup history" ON backup_history;
CREATE POLICY "Super admins can insert backup history"
  ON backup_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );


-- ====================================
-- PASO 27: POLÍTICAS RLS - BACKUP CONFIG
-- ====================================

DROP POLICY IF EXISTS "Super admins can view backup config" ON backup_config;
CREATE POLICY "Super admins can view backup config"
  ON backup_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Super admins can update backup config" ON backup_config;
CREATE POLICY "Super admins can update backup config"
  ON backup_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Super admins can insert backup config" ON backup_config;
CREATE POLICY "Super admins can insert backup config"
  ON backup_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active = true
      AND deleted_at IS NULL
    )
  );


-- ====================================
-- PASO 28: DATOS INICIALES
-- ====================================

-- Insertar 6 mesas iniciales
INSERT INTO public.tables (name, seats, status)
VALUES
  ('Mesa 1', 4, 'available'),
  ('Mesa 2', 4, 'available'),
  ('Mesa 3', 4, 'available'),
  ('Mesa 4', 4, 'available'),
  ('Mesa 5', 4, 'available'),
  ('Mesa 6', 4, 'available')
ON CONFLICT (name) DO NOTHING;

-- Insertar permisos por rol
INSERT INTO role_permissions (role, section, page_id, can_access, can_confirm_order, can_validate_order) VALUES
  -- SUPER ADMIN - Acceso total
  ('super_admin', 'Ventas', 'floor', true, true, true),
  ('super_admin', 'Ventas', 'pos', true, true, true),
  ('super_admin', 'Ventas', 'orders', true, true, true),
  ('super_admin', 'Inventario', 'products', true, true, true),
  ('super_admin', 'Inventario', 'categories', true, true, true),
  ('super_admin', 'Inventario', 'users', true, true, true),
  ('super_admin', 'Finanzas', 'cash', true, true, true),
  ('super_admin', 'Finanzas', 'time-tracking', true, true, true),
  ('super_admin', 'Finanzas', 'suppliers', true, true, true),
  ('super_admin', 'Finanzas', 'expenses', true, true, true),
  ('super_admin', 'Finanzas', 'analytics', true, true, true),
  ('super_admin', 'Sistema', 'role-management', true, true, true),
  ('super_admin', 'Sistema', 'company-settings', true, true, true),
  ('super_admin', 'Sistema', 'app-settings', true, true, true),
  ('super_admin', 'Sistema', 'tables', true, true, true),
  ('super_admin', 'system', 'backup', true, true, true),
  -- ADMIN - Acceso completo excepto gestión de roles
  ('admin', 'Ventas', 'floor', true, true, true),
  ('admin', 'Ventas', 'pos', true, true, true),
  ('admin', 'Ventas', 'orders', true, true, true),
  ('admin', 'Inventario', 'products', true, true, true),
  ('admin', 'Inventario', 'categories', true, true, true),
  ('admin', 'Inventario', 'users', true, true, true),
  ('admin', 'Finanzas', 'cash', true, true, true),
  ('admin', 'Finanzas', 'time-tracking', true, true, true),
  ('admin', 'Finanzas', 'suppliers', true, true, true),
  ('admin', 'Finanzas', 'expenses', true, true, true),
  ('admin', 'Finanzas', 'analytics', true, true, true),
  ('admin', 'Sistema', 'role-management', false, true, true),
  ('admin', 'Sistema', 'app-settings', true, true, true),
  ('admin', 'Sistema', 'tables', true, true, true),
  -- CASHIER - Ventas y caja
  ('cashier', 'Ventas', 'floor', true, true, true),
  ('cashier', 'Ventas', 'pos', true, true, true),
  ('cashier', 'Ventas', 'orders', true, true, true),
  ('cashier', 'Inventario', 'products', false, true, true),
  ('cashier', 'Inventario', 'categories', false, true, true),
  ('cashier', 'Inventario', 'users', false, true, true),
  ('cashier', 'Finanzas', 'cash', true, true, true),
  ('cashier', 'Finanzas', 'time-tracking', false, true, true),
  ('cashier', 'Finanzas', 'suppliers', false, true, true),
  ('cashier', 'Finanzas', 'expenses', false, true, true),
  ('cashier', 'Finanzas', 'analytics', false, true, true),
  ('cashier', 'Sistema', 'role-management', false, true, true),
  -- BARISTA - Solo ventas
  ('barista', 'Ventas', 'floor', true, true, true),
  ('barista', 'Ventas', 'pos', true, true, true),
  ('barista', 'Ventas', 'orders', true, true, true),
  ('barista', 'Inventario', 'products', false, true, true),
  ('barista', 'Inventario', 'categories', false, true, true),
  ('barista', 'Inventario', 'users', false, true, true),
  ('barista', 'Finanzas', 'cash', false, true, true),
  ('barista', 'Finanzas', 'time-tracking', false, true, true),
  ('barista', 'Finanzas', 'suppliers', false, true, true),
  ('barista', 'Finanzas', 'expenses', false, true, true),
  ('barista', 'Finanzas', 'analytics', false, true, true),
  ('barista', 'Sistema', 'role-management', false, true, true),
  -- WAITER - Sala y órdenes (sin validar)
  ('waiter', 'Ventas', 'floor', true, true, false),
  ('waiter', 'Ventas', 'pos', false, true, false),
  ('waiter', 'Ventas', 'orders', true, true, false),
  ('waiter', 'Inventario', 'products', false, true, false),
  ('waiter', 'Inventario', 'categories', false, true, false),
  ('waiter', 'Inventario', 'users', false, true, false),
  ('waiter', 'Finanzas', 'cash', false, true, false),
  ('waiter', 'Finanzas', 'time-tracking', false, true, false),
  ('waiter', 'Finanzas', 'suppliers', false, true, false),
  ('waiter', 'Finanzas', 'expenses', false, true, false),
  ('waiter', 'Finanzas', 'analytics', false, true, false),
  ('waiter', 'Sistema', 'role-management', false, true, false)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- Insertar configuración de empresa
INSERT INTO company_settings (company_name, address, phone)
VALUES ('Tienda de Ropa', 'Calle Principal #123', '+34 000 000 000')
ON CONFLICT DO NOTHING;

-- Insertar configuración de divisa
INSERT INTO app_currency_settings (currency_code, currency_symbol, currency_name, decimal_places, position)
VALUES ('EUR', '€', 'Euro', 2, 'after')
ON CONFLICT DO NOTHING;

-- Insertar divisas disponibles
INSERT INTO available_currencies (code, symbol, name, decimal_places, symbol_position) VALUES
  ('EUR', '€', 'Euro', 2, 'after'),
  ('USD', '$', 'US Dollar', 2, 'before'),
  ('MAD', 'DH', 'Dirham Marroquí', 2, 'after'),
  ('GBP', '£', 'British Pound', 2, 'before'),
  ('MXN', 'MX$', 'Mexican Peso', 2, 'before')
ON CONFLICT (code) DO NOTHING;

-- Insertar configuración de backup
INSERT INTO backup_config (
  tables, s3_enabled, schedule_enabled, schedule_time, schedule_frequency, retention_days
) VALUES (
  ARRAY['products', 'categories', 'orders', 'order_items', 'employee_profiles', 'cash_register_sessions', 'role_permissions', 'company_settings', 'tables'],
  true, false, '02:00', 'daily', 30
)
ON CONFLICT DO NOTHING;


-- ====================================
-- PASO 29: VISTAS ÚTILES
-- ====================================

-- Vista de divisa actual
CREATE OR REPLACE VIEW current_currency AS
SELECT
  currency_code,
  currency_symbol,
  currency_name,
  decimal_places,
  position,
  updated_at as last_changed
FROM app_currency_settings
LIMIT 1;

-- Vista de estadísticas de backup
CREATE OR REPLACE VIEW backup_statistics AS
SELECT
  backup_type,
  COUNT(*) as total_backups,
  AVG(size_mb) as avg_size_mb,
  SUM(size_mb) as total_size_mb,
  MAX(created_at) as last_backup,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN s3_url IS NOT NULL THEN 1 END) as s3_backups_count
FROM backup_history
GROUP BY backup_type;


-- ====================================
-- PASO 30: PERMISOS GRANT
-- ====================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.suppliers TO anon, authenticated;
GRANT ALL ON public.expenses TO anon, authenticated;
GRANT ALL ON public.categories TO anon, authenticated;


-- ====================================
-- PASO 31: CREAR USUARIO SUPER ADMIN
-- ====================================
-- IMPORTANTE: Este paso debe ejecutarse DESPUÉS de crear el primer usuario en Supabase Auth
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > Authentication > Users
-- 2. Crea un nuevo usuario con email y contraseña
-- 3. COPIA el ID del usuario (UUID) que aparece en la tabla de usuarios
-- 4. Reemplaza 'TU_USER_ID_AQUI' en el comando siguiente con el ID que copiaste
-- 5. Ejecuta el siguiente comando en Supabase SQL Editor:
--
-- INSERT INTO employee_profiles (id, full_name, role, email, phone, active)
-- VALUES (
--   'TU_USER_ID_AQUI'::uuid,
--   'Super Administrador',
--   'super_admin',
--   'admin@tienda.com',
--   '+34 000 000 000',
--   true
-- );
--
-- EJEMPLO CON UN ID REAL:
-- INSERT INTO employee_profiles (id, full_name, role, email, phone, active)
-- VALUES (
--   '12345678-1234-1234-1234-123456789012'::uuid,
--   'Super Administrador',
--   'super_admin',
--   'admin@tienda.com',
--   '+34 000 000 000',
--   true
-- );
--
-- NOTA: El ID debe coincidir EXACTAMENTE con el ID del usuario creado en Authentication
-- ====================================


-- ====================================
-- FIN DE LA MIGRACIÓN
-- ====================================
-- La migración se ha completado exitosamente
-- Base de datos lista para tienda de ropa
-- ====================================
