import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const CLOUD_URL = 'https://zeqootmdlfpospbwwzuh.supabase.co';
const CLOUD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcW9vdG1kbGZwb3NwYnd3enVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc5NjEyNCwiZXhwIjoyMDgxMzcyMTI0fQ.GExvcYW5-Au_Wp01YgaljD46JCk0nRDXxBHy6jNs0VM';

const supabase = createClient(CLOUD_URL, CLOUD_SERVICE_KEY);

const TABLES = [
  'categories', 'products', 'product_sizes', 'customers', 'tables', 
  'suppliers', 'expenses', 'employee_profiles', 'orders', 'order_items', 
  'order_history', 'cash_register_sessions', 'cash_withdrawals', 
  'deleted_products', 'deleted_orders', 'role_permissions', 
  'company_settings', 'available_currencies', 'app_currency_settings', 
  'product_images', 'order_returns'
];

async function exportData() {
  console.log('📡 Conectando a Supabase Cloud...');
  const backup = {};

  for (const table of TABLES) {
    console.log(`Reading ${table}...`);
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.from(table).select('*').range(from, to);
      if (error) {
        console.error(`   Error reading ${table}:`, error.message);
        hasMore = false;
      } else {
        allData = allData.concat(data);
        if (data.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      }
    }
    
    backup[table] = allData;
    console.log(`   Read ${allData.length} records.`);
  }

  fs.writeFileSync('cloud_backup.json', JSON.stringify(backup, null, 2));
  console.log('✅ Backup guardado en cloud_backup.json');
}

exportData();
