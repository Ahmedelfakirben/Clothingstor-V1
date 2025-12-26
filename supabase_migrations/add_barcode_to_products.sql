ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text UNIQUE;
COMMENT ON COLUMN public.products.barcode IS 'Standard barcode (EAN, UPC, etc.)';
