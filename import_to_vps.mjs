import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const VPS_URL = 'http://49.13.52.159';
const VPS_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjoyMDgxMzcyMTI0LCJyb2xlIjoiYW5vbiJ9.QmEBRrb5tFb-B3sQRLAK56_DvTvS0TbqlkTWp5gMvWk';
const VPS_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjoyMDgxMzcyMTI0LCJyb2xlIjoic2VydmljZV9yb2xlIn0.cET6t_Y399BLWenRWVzU6fDB4cY1nGnwHi5-3VMVJL8';

const supabase = createClient(VPS_URL, VPS_ANON_KEY);
const supabaseAdmin = createClient(VPS_URL, VPS_SERVICE_KEY);


const TABLES = [
  'categories', 'products', 'product_sizes', 'customers', 'tables', 
  'suppliers', 'employee_profiles', 'orders', 'order_items', 
  'order_history', 'cash_register_sessions', 'cash_withdrawals', 
  'deleted_products', 'deleted_orders', 'role_permissions', 
  'company_settings', 'available_currencies', 'app_currency_settings', 
  'product_images', 'order_returns'
];

async function importAll() {
  console.log('🚀 Iniciando importación al VPS...');

  // 1. Importar Usuarios
  console.log('\n👥 Importando usuarios de Auth...');
  const users = JSON.parse(fs.readFileSync('cloud_users.json', 'utf8'));
  for (const u of users) {
    console.log(`   Creando usuario: ${u.email}...`);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: 'Password123!', // Contraseña temporal, el usuario deberá cambiarla o usar recovery
      email_confirm: true,
      user_metadata: u.user_metadata
    });
    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`   ℹ️ El usuario ${u.email} ya existe.`);
      } else {
        console.error(`   ❌ Error con ${u.email}:`, error.message);
      }
    }
  }

  // 2. Importar Tablas
  console.log('\n📦 Importando datos de tablas...');
  const backup = JSON.parse(fs.readFileSync('cloud_backup.json', 'utf8'));

  for (const table of TABLES) {
    const data = backup[table];
    if (!data || data.length === 0) continue;

    console.log(`   Subiendo ${data.length} registros a ${table}...`);
    
    // Dividir en bloques de 100 para evitar errores de tamaño de payload
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(table).upsert(chunk);
      if (error) {
        console.error(`   ❌ Error en ${table} (bloque ${i}):`, error.message);
      }
    }
    console.log(`   ✅ ${table} completada.`);
  }

  console.log('\n✨ ¡IMPORTACIÓN COMPLETADA CON ÉXITO!');
  console.log('Nota: Los usuarios han sido creados con la contraseña temporal: Password123!');
}

importAll().catch(console.error);
