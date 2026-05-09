import fs from 'fs';

const schema = fs.readFileSync('full_schema.sql', 'utf8').replace(/^\uFEFF/, '');
const backup = JSON.parse(fs.readFileSync('cloud_backup.json', 'utf8'));
const users = JSON.parse(fs.readFileSync('cloud_users.json', 'utf8'));

let sql = `-- MIGRACIÓN TOTAL DEFINITIVA V4\n\n`;

sql += `DROP SCHEMA IF EXISTS public CASCADE;\n`;
sql += `CREATE SCHEMA public;\n`;
sql += `GRANT ALL ON SCHEMA public TO postgres;\n`;
sql += `GRANT ALL ON SCHEMA public TO anon;\n`;
sql += `GRANT ALL ON SCHEMA public TO authenticated;\n`;
sql += `GRANT ALL ON SCHEMA public TO service_role;\n\n`;

sql += `CREATE EXTENSION IF NOT EXISTS pgcrypto;\n`;
sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n`;

sql += `-- USUARIOS DE AUTH\n`;
sql += `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, raw_app_meta_data, raw_user_meta_data, is_sso_user)\nVALUES \n`;
sql += users.map(u => `('${u.id}', '${u.email}', crypt('Password123!', gen_salt('bf')), now(), 'authenticated', 'authenticated', '${JSON.stringify(u.app_metadata).replace(/'/g, "''")}', '${JSON.stringify(u.user_metadata).replace(/'/g, "''")}', false)`).join(',\n') + '\n';
sql += `ON CONFLICT (id) DO NOTHING;\n\n`;

let enhancedSchema = schema;
// Parche de productos ultra completo
enhancedSchema = enhancedSchema.replace('stock integer DEFAULT 0', 'stock integer DEFAULT 0,\n  track_individual_units boolean DEFAULT false,\n  purchase_price decimal(10,2) DEFAULT 0,\n  barcode text,\n  needs_validation boolean DEFAULT false,\n  created_by uuid REFERENCES auth.users(id),\n  validated_by uuid REFERENCES auth.users(id)');

// Parche de pedidos
enhancedSchema = enhancedSchema.replace('notes text DEFAULT \'\',', 'notes text DEFAULT \'\',\n  amount_paid decimal(10,2) DEFAULT 0,\n  payment_status text DEFAULT \'paid\',');

// Parche de order_items
enhancedSchema = enhancedSchema.replace('subtotal decimal(10,2) NOT NULL,', 'subtotal decimal(10,2) NOT NULL,\n  purchase_price decimal(10,2) DEFAULT 0,');

sql += enhancedSchema;

sql += `\n\n-- DATOS DE TABLAS\n`;

const TABLES = [
  'categories', 'products', 'product_sizes', 'customers', 'tables', 
  'suppliers', 'employee_profiles', 'orders', 'order_items', 
  'order_history', 'cash_register_sessions', 'cash_withdrawals', 
  'deleted_products', 'deleted_orders', 'role_permissions', 
  'company_settings', 'available_currencies', 'app_currency_settings', 
  'product_images', 'order_returns'
];

function escape(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return val;
}

for (const table of TABLES) {
  const data = backup[table];
  if (!data || data.length === 0) continue;

  sql += `\n-- Tabla: ${table}\n`;
  const columns = Object.keys(data[0]);
  
  for (let i = 0; i < data.length; i += 50) {
    const chunk = data.slice(i, i + 50);
    sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES \n`;
    sql += chunk.map(row => `(${columns.map(col => escape(row[col])).join(', ')})`).join(',\n') + ';\n';
  }
}

fs.writeFileSync('total_migration.sql', sql);
console.log('✅ total_migration.sql V4 generado.');



