CREATE OR REPLACE FUNCTION public.list_platform_admins()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  RETURN QUERY
  SELECT pau.user_id, u.email::TEXT, pau.created_at::TIMESTAMPTZ
  FROM public.platform_admin_users pau
  JOIN auth.users u ON u.id = pau.user_id
  ORDER BY u.email;
END;
$$;
