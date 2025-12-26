-- Add partial payment support to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS amount_paid decimal(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('pending', 'partial', 'paid'));

-- Update existing orders to have amount_paid = total and payment_status = 'paid' for data consistency
UPDATE public.orders 
SET amount_paid = total, payment_status = 'paid' 
WHERE amount_paid = 0 AND status = 'completed';

COMMENT ON COLUMN public.orders.amount_paid IS 'Amount paid so far (Anticipo)';
COMMENT ON COLUMN public.orders.payment_status IS 'Status of the payment: pending (0), partial (< total), paid (= total)';
