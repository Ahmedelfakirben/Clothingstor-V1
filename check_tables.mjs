import { createClient } from '@supabase/supabase-js';

const VPS_URL = 'http://supabasekong-iypl4n3qbminz5dsn7nrksj5.49.13.52.159.sslip.io';
const VPS_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjoyMDgxMzcyMTI0LCJyb2xlIjoic2VydmljZV9yb2xlIn0.cET6t_Y399BLWenRWVzU6fDB4cY1nGnwHi5-3VMVJL8';

const supabase = createClient(VPS_URL, VPS_SERVICE_KEY);

async function checkTables() {
  const tables = ['categories', 'products'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('count').limit(1);
    if (error) {
      console.log(`Table ${t}: Error - ${error.message}`);
    } else {
      console.log(`Table ${t}: EXISTS`);
    }
  }
}

checkTables();
