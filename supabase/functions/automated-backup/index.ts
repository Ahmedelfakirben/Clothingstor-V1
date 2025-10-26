// Supabase Edge Function para Backup Automático a S3
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://deno.land/x/s3_lite_client@0.6.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupConfig {
  tables: string[];
  s3_enabled: boolean;
  schedule_enabled: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('No autorizado');
    }

    // Verificar que el usuario es super_admin
    const { data: profile, error: profileError } = await supabase
      .from('employee_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'super_admin') {
      throw new Error('Solo super_admin puede ejecutar backups automáticos');
    }

    // Obtener configuración de backup
    const { data: config, error: configError } = await supabase
      .from('backup_config')
      .select('*')
      .single();

    if (configError && configError.code !== 'PGRST116') {
      throw configError;
    }

    // Configuración por defecto si no existe
    const backupConfig: BackupConfig = config || {
      tables: [
        'products',
        'categories',
        'orders',
        'order_items',
        'employee_profiles',
        'cash_register_sessions',
        'role_permissions',
        'company_settings',
        'app_settings',
        'tables',
      ],
      s3_enabled: true,
      schedule_enabled: true,
    };

    console.log('📦 Iniciando backup automático...', backupConfig);

    // Crear objeto de backup
    const backupData: any = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'automatic',
      metadata: {
        created_by: user.email,
        created_at: new Date().toISOString(),
        tables_count: backupConfig.tables.length,
      },
      tables: {},
    };

    let totalRecords = 0;

    // Exportar cada tabla
    for (const tableName of backupConfig.tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`❌ Error exportando tabla ${tableName}:`, error);
          continue;
        }

        backupData.tables[tableName] = data || [];
        totalRecords += (data || []).length;
        console.log(`✅ Tabla ${tableName}: ${(data || []).length} registros`);
      } catch (err) {
        console.error(`❌ Error procesando tabla ${tableName}:`, err);
      }
    }

    // Convertir a JSON
    const jsonString = JSON.stringify(backupData, null, 2);
    const sizeInBytes = new TextEncoder().encode(jsonString).length;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    console.log(`📊 Backup creado: ${totalRecords} registros, ${sizeInMB} MB`);

    // Subir a S3 si está habilitado
    let s3Url = null;
    if (backupConfig.s3_enabled) {
      try {
        const s3Client = new S3Client({
          endPoint: Deno.env.get('S3_ENDPOINT')!.replace('https://', ''),
          region: Deno.env.get('S3_REGION') || 'eu-central-1',
          accessKey: Deno.env.get('S3_ACCESS_KEY')!,
          secretKey: Deno.env.get('S3_SECRET_KEY')!,
          useSSL: true,
        });

        const bucketName = Deno.env.get('S3_BUCKET_NAME') || 'coffee-shop-backups';
        const fileName = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;

        console.log(`☁️ Subiendo a S3: ${bucketName}/${fileName}`);

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: jsonString,
            ContentType: 'application/json',
          })
        );

        s3Url = `${Deno.env.get('S3_ENDPOINT')}/${bucketName}/${fileName}`;
        console.log(`✅ Backup subido a S3: ${s3Url}`);
      } catch (s3Error) {
        console.error('❌ Error subiendo a S3:', s3Error);
        // Continuar aunque falle S3
      }
    }

    // Registrar en historial
    try {
      await supabase.from('backup_history').insert({
        created_by: user.id,
        backup_type: 'automatic',
        size_mb: parseFloat(sizeInMB),
        tables_included: backupConfig.tables,
        status: 'completed',
        notes: s3Url ? `Subido a S3: ${s3Url}` : 'Backup local',
      });
      console.log('✅ Registro guardado en historial');
    } catch (historyError) {
      console.error('❌ Error guardando en historial:', historyError);
    }

    // Respuesta
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup automático completado exitosamente',
        data: {
          timestamp: backupData.timestamp,
          total_records: totalRecords,
          size_mb: parseFloat(sizeInMB),
          tables_count: backupConfig.tables.length,
          s3_url: s3Url,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error en backup automático:', error);
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
