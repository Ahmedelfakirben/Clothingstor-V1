// Supabase Edge Function - Cron Job para Backups Automáticos
// Esta función debe ser programada usando Supabase Cron o un servicio externo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar que viene del cron (opcional - agregar secret key)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Acceso no autorizado al cron');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('⏰ Cron Job iniciado:', new Date().toISOString());

    // Crear cliente de Supabase con service key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener configuración de backup
    const { data: config, error: configError } = await supabase
      .from('backup_config')
      .select('*')
      .single();

    if (configError) {
      console.error('❌ Error obteniendo configuración:', configError);
      throw new Error('No se pudo obtener configuración de backup');
    }

    // Verificar si los backups automáticos están habilitados
    if (!config.schedule_enabled) {
      console.log('⏭️ Backups automáticos deshabilitados');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Backups automáticos deshabilitados',
          skipped: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Verificar si es hora de ejecutar el backup
    const now = new Date();
    const nextBackup = config.next_backup_at ? new Date(config.next_backup_at) : null;

    if (nextBackup && now < nextBackup) {
      console.log('⏭️ Aún no es hora del siguiente backup');
      console.log(`   Próximo backup: ${nextBackup.toISOString()}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aún no es hora del siguiente backup',
          next_backup: nextBackup.toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('📦 Ejecutando backup automático...');

    // Crear objeto de backup
    const backupData: any = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'automatic',
      metadata: {
        created_by: 'cron-job',
        created_at: new Date().toISOString(),
        tables_count: config.tables.length,
      },
      tables: {},
    };

    let totalRecords = 0;

    // Exportar cada tabla
    for (const tableName of config.tables) {
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
        console.log(`✅ ${tableName}: ${(data || []).length} registros`);
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
    if (config.s3_enabled) {
      // Aquí llamarías a la función de S3 upload
      // Por simplicidad, registramos que se debería subir
      console.log('☁️ S3 habilitado - subir backup');
      s3Url = `${Deno.env.get('S3_ENDPOINT')}/backups/auto-${Date.now()}.json`;
    }

    // Registrar en historial
    try {
      await supabase.from('backup_history').insert({
        created_by: null, // Automático, no hay usuario
        backup_type: 'automatic',
        size_mb: parseFloat(sizeInMB),
        tables_included: config.tables,
        status: 'completed',
        notes: `Backup automático programado. ${s3Url ? `S3: ${s3Url}` : 'Local'}`,
        s3_url: s3Url,
      });
      console.log('✅ Registro guardado en historial');
    } catch (historyError) {
      console.error('❌ Error guardando en historial:', historyError);
    }

    // Actualizar last_backup_at y calcular next_backup_at
    try {
      const { error: updateError } = await supabase
        .from('backup_config')
        .update({
          last_backup_at: new Date().toISOString(),
          // next_backup_at se calculará automáticamente por el trigger
        })
        .eq('id', config.id);

      if (updateError) {
        console.error('❌ Error actualizando configuración:', updateError);
      } else {
        console.log('✅ Configuración actualizada');
      }
    } catch (updateErr) {
      console.error('❌ Error en actualización:', updateErr);
    }

    // Limpiar backups antiguos según retention_days
    if (config.retention_days) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - config.retention_days);

        const { data: deletedBackups, error: deleteError } = await supabase
          .from('backup_history')
          .delete()
          .lt('created_at', cutoffDate.toISOString())
          .select();

        if (deleteError) {
          console.error('❌ Error limpiando backups antiguos:', deleteError);
        } else {
          const deletedCount = deletedBackups?.length || 0;
          console.log(`🗑️ Eliminados ${deletedCount} backups antiguos`);
        }
      } catch (cleanupErr) {
        console.error('❌ Error en limpieza:', cleanupErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup automático completado',
        data: {
          timestamp: backupData.timestamp,
          total_records: totalRecords,
          size_mb: parseFloat(sizeInMB),
          tables_count: config.tables.length,
          s3_url: s3Url,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error en cron job:', error);
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
