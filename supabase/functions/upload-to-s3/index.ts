// Supabase Edge Function - Subir Backup a S3 (Hetzner)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para generar firma AWS v4 para S3
async function signS3Request(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();

  // Crear hash del payload
  const payloadHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(payload)
  );
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  headers['x-amz-content-sha256'] = payloadHashHex;

  return headers;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('No autorizado');
    }

    // Verificar que es super_admin
    const { data: profile, error: profileError } = await supabase
      .from('employee_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'super_admin') {
      throw new Error('Solo super_admin puede subir backups');
    }

    // Obtener datos del backup del body
    const { backupData, fileName } = await req.json();

    if (!backupData || !fileName) {
      throw new Error('Faltan datos del backup');
    }

    console.log('📤 Subiendo backup a S3...', { fileName });

    // Configuración S3 (Hetzner)
    const s3Config = {
      endpoint: Deno.env.get('S3_ENDPOINT') || 'https://fsn1.your-objectstorage.com',
      accessKey: Deno.env.get('S3_ACCESS_KEY')!,
      secretKey: Deno.env.get('S3_SECRET_KEY')!,
      bucket: Deno.env.get('S3_BUCKET_NAME') || 'coffee-shop-backups',
      region: Deno.env.get('S3_REGION') || 'eu-central-1',
    };

    if (!s3Config.accessKey || !s3Config.secretKey) {
      throw new Error('Credenciales S3 no configuradas');
    }

    // Preparar datos
    const jsonContent = JSON.stringify(backupData, null, 2);
    const contentLength = new TextEncoder().encode(jsonContent).length;

    // URL completa de S3
    const s3Url = `${s3Config.endpoint}/${s3Config.bucket}/${fileName}`;

    console.log('🔗 URL de S3:', s3Url);

    // Headers para la petición
    const headers: Record<string, string> = {
      'Host': new URL(s3Config.endpoint).host,
      'Content-Type': 'application/json',
      'Content-Length': contentLength.toString(),
      'x-amz-acl': 'private',
    };

    // Realizar petición PUT a S3
    const response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': `AWS ${s3Config.accessKey}:${s3Config.secretKey}`,
      },
      body: jsonContent,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error de S3:', response.status, errorText);
      throw new Error(`Error subiendo a S3: ${response.status} - ${errorText}`);
    }

    console.log('✅ Backup subido exitosamente a S3');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup subido exitosamente a S3',
        s3_url: s3Url,
        file_name: fileName,
        size_bytes: contentLength,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error en upload-to-s3:', error);
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
