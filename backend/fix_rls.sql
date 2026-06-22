CREATE OR REPLACE FUNCTION can_access_firm(check_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_firm_id UUID;
BEGIN
  -- Get caller's profile
  SELECT role, firm_id INTO user_role, user_firm_id
  FROM profiles
  WHERE id = auth.uid();

  -- CA users: God Mode (sees all firms)
  IF user_role IN ('ca_admin', 'ca_employee') THEN
    RETURN TRUE;
  END IF;

  -- Merchants: must have explicit access via the junction table OR own the firm
  RETURN EXISTS (
    SELECT 1 FROM user_firm_access
    WHERE user_id = auth.uid() AND firm_id = check_firm_id
  ) OR (user_firm_id = check_firm_id);
END;
$$;
