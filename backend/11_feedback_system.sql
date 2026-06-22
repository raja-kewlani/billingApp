CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    is_solved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own feedback
CREATE POLICY "Merchants can view their own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = created_by);

-- Policy: Merchants can insert their own feedback
CREATE POLICY "Merchants can insert their own feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy: Merchants can delete their own feedback
CREATE POLICY "Merchants can delete their own feedback" ON public.feedback
    FOR DELETE USING (auth.uid() = created_by);

-- Policy: CA / CA Admin can view feedback for all firms (since CAs have god mode across firms based on can_access_firm)
-- Using the existing helper function can_access_firm
CREATE POLICY "CA can view feedback" ON public.feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ca_admin', 'ca_employee')
        )
    );

-- Policy: CA / CA Admin can update feedback (specifically to mark as solved)
CREATE POLICY "CA can update feedback" ON public.feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ca_admin', 'ca_employee')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ca_admin', 'ca_employee')
        )
    );
