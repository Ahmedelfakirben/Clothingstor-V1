// Edge Function para subir backups a S3 de Hetzner
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { backupData, fileName } = await req.json();

    if (!backupData || !fileName) {
      throw new Error('Faltan datos del backup');
    }

    // Configuración S3 de Hetzner
    const endpoint = Deno.env.get('S3_ENDPOINT') || 'https://fsn1.your-objectstorage.com';
    const accessKey = Deno.env.get('S3_ACCESS_KEY');
    const secretKey = Deno.env.get('S3_SECRET_KEY');
    const bucket = Deno.env.get('S3_BUCKET_NAME') || 'coffee-shop-backups';

    if (!accessKey || !secretKey) {
      throw new Error('Credenciales S3 no configuradas en Supabase');
    }

    console.log('📤 Subiendo a S3 Hetzner...');
    console.log('Endpoint:', endpoint);
    console.log('Bucket:', bucket);
    console.log('Archivo:', fileName);

    const jsonContent = JSON.stringify(backupData, null, 2);

    // Construir URL completa
    const url = `${endpoint}/${bucket}/${fileName}`;

    // Crear headers básicos
    const date = new Date().toUTCString();
    const contentType = 'application/json';
    const contentLength = new TextEncoder().encode(jsonContent).length;

    // Para S3 compatible, usamos autenticación básica AWS
    const authString = `${accessKey}:${secretKey}`;
    const authBase64 = btoa(authString);

    console.log('📡 Realizando petición PUT a:', url);

    // Hacer petición PUT a S3
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
        'Date': date,
        'Authorization': `AWS ${accessKey}:${secretKey}`,
        'x-amz-acl': 'private',
      },
      body: jsonContent,
    });

    console.log('📊 Respuesta S3:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error de S3:', errorText);
      throw new Error(`Error subiendo a S3: ${response.status} - ${errorText}`);
    }

    console.log('✅ Backup subido exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        s3_url: url,
        file_name: fileName,
        size_mb: (contentLength / (1024 * 1024)).toFixed(2),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
