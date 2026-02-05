-- ==============================================================================
-- AGGRESSIVE DEDUPLICATION SCRIPT
-- ==============================================================================
-- This script identifies duplicate products by normalizing their names
-- (lowercase, trimmed, single spaces).
-- It keeps the oldest product as MASTER and merges all others into it.
--
-- ACTIONS:
-- 1. Merges 'product_sizes':
--    - If Master has the same size, stock is summed and duplicate size is deleted.
--    - If Master lacks the size, the duplicate size is moved to Master.
-- 2. Re-links 'order_items':
--    - Updates product_id and size_id to point to the Master.
-- 3. Sums 'stock' from duplicate product to Master product.
-- 4. Deletes the duplicate product records.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    duplicate_ids UUID[];
    dup_id UUID;
    master_id UUID;
    size_record RECORD;
    master_size_id UUID;
    moved_count INT := 0;
    deleted_count INT := 0;
    dup_stock INT;
BEGIN
    RAISE NOTICE 'Starting Aggressive Deduplication...';

    -- 1. Loop through groups of duplicates
    -- We group by normalized name
    FOR r IN
        SELECT
            lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) as normalized_name,
            array_agg(id ORDER BY created_at ASC) as ids,
            count(*) as cnt
        FROM products
        -- Optional: Filter only available? No, we want to clean everything.
        GROUP BY 1
        HAVING count(*) > 1
    LOOP
        RAISE NOTICE 'Processing duplicate group: "%" (Count: %)', r.normalized_name, r.cnt;

        -- 2. Identify Master (First one because ordered by created_at ASC)
        master_id := r.ids[1];
        duplicate_ids := r.ids[2:array_length(r.ids, 1)];

        RAISE NOTICE '  Master ID: %', master_id;

        -- 3. Process each duplicate
        FOREACH dup_id IN ARRAY duplicate_ids
        LOOP
            RAISE NOTICE '    Merging duplicate ID: %', dup_id;

            -- 3a. Merge Product Sizes
            FOR size_record IN SELECT * FROM product_sizes WHERE product_id = dup_id
            LOOP
                -- Check if master has this size (case insensitive size name check)
                SELECT id INTO master_size_id
                FROM product_sizes
                WHERE product_id = master_id 
                AND lower(size_name) = lower(size_record.size_name);

                IF master_size_id IS NOT NULL THEN
                    -- Master has size -> Sum stock and delete duplicate size
                    UPDATE product_sizes
                    SET stock = COALESCE(stock, 0) + COALESCE(size_record.stock, 0)
                    WHERE id = master_size_id;

                    -- Reassign order_items pointing to the duplicate size to the master size
                    UPDATE order_items
                    SET size_id = master_size_id
                    WHERE size_id = size_record.id;

                    -- Delete the duplicate size record
                    DELETE FROM product_sizes WHERE id = size_record.id;
                    RAISE NOTICE '      Merged size % (Stock added: %)', size_record.size_name, size_record.stock;
                ELSE
                    -- Master does not have size -> Move it
                    UPDATE product_sizes
                    SET product_id = master_id
                    WHERE id = size_record.id;
                    RAISE NOTICE '      Moved size %', size_record.size_name;
                END IF;
            END LOOP;

            -- 3b. Merge Order Items (Product Level)
            UPDATE order_items
            SET product_id = master_id
            WHERE product_id = dup_id;
            
            -- Also handle order_history jsonb if possible? 
            -- Ignoring JSONB inside order_history for complexity reasons, 
            -- strictly relational constraints are the priority.

            -- 3c. Merge Stock (Product Level default stock column)
            SELECT stock INTO dup_stock FROM products WHERE id = dup_id;
            UPDATE products
            SET stock = COALESCE(stock, 0) + COALESCE(dup_stock, 0)
            WHERE id = master_id;

            -- 3d. Delete Duplicate Product
            DELETE FROM products WHERE id = dup_id;
            deleted_count := deleted_count + 1;

        END LOOP;

        moved_count := moved_count + 1;
    END LOOP;

    RAISE NOTICE 'Deduplication Complete.';
    RAISE NOTICE 'Groups processed: %', moved_count;
    RAISE NOTICE 'Products merged (deleted): %', deleted_count;
END $$;
