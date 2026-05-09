import { createClient } from '@supabase/supabase-js';

const VPS_URL = 'http://supabasekong-iypl4n3qbminz5dsn7nrksj5.49.13.52.159.sslip.io';
const VPS_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjoyMDgxMzcyMTI0LCJyb2xlIjoic2VydmljZV9yb2xlIn0.cET6t_Y399BLWenRWVzU6fDB4cY1nGnwHi5-3VMVJL8';

const supabase = createClient(VPS_URL, VPS_SERVICE_KEY);

async function debugConnection() {
  console.log(`URL: ${VPS_URL}`);
  
  const { data, error, status, statusText } = await supabase.from('categories').select('*');
  
  if (error) {
    console.log('--- ERROR DETAILS ---');
    console.log('Status:', status);
    console.log('Status Text:', statusText);
    console.log('Message:', error.message);
    console.log('Code:', error.code);
    console.log('Hint:', error.hint);
    console.log('Details:', error.details);
  } else {
    console.log('Success! Data:', data);
  }
}

debugConnection();
