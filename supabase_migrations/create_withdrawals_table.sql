-- Create table for cash withdrawals
CREATE TABLE IF NOT EXISTS public.cash_withdrawals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    withdrawn_by UUID REFERENCES auth.users(id),
    withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read/write for authenticated users" ON public.cash_withdrawals
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.cash_withdrawals TO authenticated;
GRANT ALL ON public.cash_withdrawals TO service_role;
