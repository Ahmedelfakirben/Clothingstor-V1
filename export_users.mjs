import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const CLOUD_URL = 'https://zeqootmdlfpospbwwzuh.supabase.co';
const CLOUD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcW9vdG1kbGZwb3NwYnd3enVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc5NjEyNCwiZXhwIjoyMDgxMzcyMTI0fQ.GExvcYW5-Au_Wp01YgaljD46JCk0nRDXxBHy6jNs0VM';

const supabase = createClient(CLOUD_URL, CLOUD_SERVICE_KEY);

async function exportUsers() {
  console.log('📡 Exportando usuarios de Cloud...');
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error exportando usuarios:', error.message);
    return;
  }

  fs.writeFileSync('cloud_users.json', JSON.stringify(users, null, 2));
  console.log(`✅ ${users.length} usuarios exportados a cloud_users.json`);
}

exportUsers();
