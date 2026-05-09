import { createClient } from '@supabase/supabase-js';

const VPS_URL = 'http://supabasekong-iypl4n3qbminz5dsn7nrksj5.49.13.52.159.sslip.io';
const VPS_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjo0OTMzNDE2NDIwLCJyb2xlIjoiYW5vbiJ9.QmEBRrb5tFb-B3sQRLAK56_DvTvS0TbqlkTWp5gMvWk';

const supabase = createClient(VPS_URL, VPS_ANON_KEY);

async function testConnection() {
  console.log('Testing connection to VPS...');
  // Intentar crear una tabla temporal (esto requiere permisos de admin)
  const { error } = await supabase.rpc('execute_sql', { 
    sql: 'CREATE TABLE IF NOT EXISTS connection_test (id serial primary key);' 
  });

  if (error) {
    console.log('Error (esto es normal con Anon Key):', error.message);
    // Intentar una consulta simple de lectura
    const { data, error: readError } = await supabase.from('categories').select('*').limit(1);
    if (readError) {
      console.log('Read error:', readError.message);
    } else {
      console.log('Read success! (Anon Key works for reading if table exists)');
    }
  } else {
    console.log('SUCCESS! This Anon Key has admin permissions (UNSAFE but useful for migration).');
  }
}

testConnection();
