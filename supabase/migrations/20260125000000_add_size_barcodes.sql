-- Add barcode column to product_sizes table
ALTER TABLE public.product_sizes 
ADD COLUMN IF NOT EXISTS barcode text;

-- Create a unique index to ensure barcodes are unique across sizes
-- We use a partial index to allow multiple NULLs (though standard unique constraint usually allows multiple nulls in Postgres, being explicit is good)
CREATE UNIQUE INDEX IF NOT EXISTS product_sizes_barcode_idx ON public.product_sizes (barcode) WHERE barcode IS NOT NULL;
