-- Create product_units table for individual barcode tracking
CREATE TABLE IF NOT EXISTS product_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  individual_barcode TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('available', 'sold', 'reserved')) DEFAULT 'available' NOT NULL,
  sold_at TIMESTAMP,
  sold_in_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(individual_barcode);
CREATE INDEX IF NOT EXISTS idx_product_units_status ON product_units(status);

-- Add column to products table to track if individual units are managed
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_individual_units BOOLEAN DEFAULT FALSE;

-- Add RLS policies for product_units
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view product units
CREATE POLICY "Authenticated users can view product units"
  ON product_units FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert product units
CREATE POLICY "Authenticated users can insert product units"
  ON product_units FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update product units
CREATE POLICY "Authenticated users can update product units"
  ON product_units FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: All authenticated users can delete product units
CREATE POLICY "Authenticated users can delete product units"
  ON product_units FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_units_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_product_units_timestamp
  BEFORE UPDATE ON product_units
  FOR EACH ROW
  EXECUTE FUNCTION update_product_units_updated_at();

-- Add comment
COMMENT ON TABLE product_units IS 'Stores individual barcode tracking for specific product units';
