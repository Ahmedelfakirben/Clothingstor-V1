-- ====================================
-- LISTAR TODAS LAS TABLAS EN PUBLIC SCHEMA
-- ====================================
-- Este script muestra todas las tablas en el esquema public
-- con información sobre número de filas y tamaño
-- ====================================

-- Opción 1: Lista simple de tablas
SELECT 
    tablename,
    schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Opción 2: Con información de filas (aproximado)
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Opción 3: Con conteo exacto de filas (puede ser lento en tablas grandes)
SELECT 
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT 
        table_schema AS schemaname,
        table_name AS tablename,
        query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) t
ORDER BY tablename;
