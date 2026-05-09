import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// CONFIGURACIÓN CLOUD (ORIGEN)
const CLOUD_URL = 'https://zeqootmdlfpospbwwzuh.supabase.co';
const CLOUD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcW9vdG1kbGZwb3NwYnd3enVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc5NjEyNCwiZXhwIjoyMDgxMzcyMTI0fQ.GExvcYW5-Au_Wp01YgaljD46JCk0nRDXxBHy6jNs0VM';

// CONFIGURACIÓN VPS (DESTINO)
const VPS_URL = 'http://supabasekong-iypl4n3qbminz5dsn7nrksj5.49.13.52.159.sslip.io';
const VPS_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3Nzc0MjgyMCwiZXhwIjo0OTMzNDE2NDIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.cET6t_Y399BLWenRWVzU6fDB4cY1nGnwHi5-3VMVJL8';

const cloud = createClient(CLOUD_URL, CLOUD_KEY);
const vps = createClient(VPS_URL, VPS_KEY);

const BUCKET = 'product-images';

async function migratePhotos() {
  console.log('🚀 Iniciando migración de fotos...');

  // 1. Listar archivos en la nube
  const { data: files, error: listError } = await cloud.storage.from(BUCKET).list('', {
    limit: 1000
  });

  if (listError) {
    console.error('❌ Error al listar archivos en Cloud:', listError);
    return;
  }

  console.log(`📦 Encontrados ${files.length} archivos para migrar.`);

  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;

    console.log(`\n🔄 Procesando: ${file.name}...`);

    // 2. Descargar de Cloud
    const { data: blob, error: downloadError } = await cloud.storage.from(BUCKET).download(file.name);

    if (downloadError) {
      console.error(`❌ Error al descargar ${file.name}:`, downloadError);
      continue;
    }

    // 3. Subir al VPS
    const { data: uploadData, error: uploadError } = await vps.storage.from(BUCKET).upload(file.name, blob, {
      upsert: true,
      contentType: blob.type
    });

    if (uploadError) {
      console.error(`❌ Error al subir ${file.name} al VPS:`, uploadError);
    } else {
      console.log(`✅ Migrado: ${file.name}`);
    }
  }

  console.log('\n✨ Migración de fotos completada.');
}

migratePhotos();
