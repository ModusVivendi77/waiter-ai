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
  SELECT pau.user_id, u.email, pau.created_at
  FROM public.platform_admin_users pau
  JOIN auth.users u ON u.id = pau.user_id
  ORDER BY u.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_platform_admin(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id UUID;
  inserted_user_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  SELECT u.id
  INTO target_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(target_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email: %', target_email;
  END IF;

  INSERT INTO public.platform_admin_users (user_id, created_by)
  VALUES (target_user_id, auth.uid())
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id INTO inserted_user_id;

  IF inserted_user_id IS NULL THEN
    inserted_user_id := target_user_id;
  END IF;

  RETURN inserted_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_platform_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  SELECT count(*)::INTEGER
  INTO admin_count
  FROM public.platform_admin_users;

  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last remaining platform admin';
  END IF;

  DELETE FROM public.platform_admin_users pau
  WHERE pau.user_id = target_user_id;

  RETURN FOUND;
END;
$$;

DROP POLICY IF EXISTS "Platform admins can view own assignment" ON public.platform_admin_users;
DROP POLICY IF EXISTS "Platform admins can view admin assignments" ON public.platform_admin_users;
CREATE POLICY "Platform admins can view admin assignments"
ON public.platform_admin_users
FOR SELECT
TO authenticated
USING (public.is_platform_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can insert admin assignments" ON public.platform_admin_users;
CREATE POLICY "Platform admins can insert admin assignments"
ON public.platform_admin_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can delete admin assignments" ON public.platform_admin_users;
CREATE POLICY "Platform admins can delete admin assignments"
ON public.platform_admin_users
FOR DELETE
TO authenticated
USING (public.is_platform_admin());
