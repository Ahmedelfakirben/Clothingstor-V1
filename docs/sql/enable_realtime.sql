-- Script para verificar y habilitar Realtime en company_settings
-- Ejecuta esto en Supabase SQL Editor

-- PASO 1: Verificar si la publicación existe
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- PASO 2: Verificar qué tablas están en la publicación
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- PASO 3: Agregar company_settings a la publicación de realtime
-- Si sale error, ignóralo (puede que ya esté agregada)
ALTER PUBLICATION supabase_realtime ADD TABLE company_settings;

-- PASO 4: Verificar que se agregó correctamente
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'company_settings';

-- PASO 5: Habilitar REPLICA IDENTITY FULL para que Realtime funcione correctamente
ALTER TABLE company_settings REPLICA IDENTITY FULL;

-- Resultado esperado: Deberías ver 'company_settings' en la lista
