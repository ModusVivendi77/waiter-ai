-- Staff table claiming.
--
-- Lets a restaurant OWNER/MANAGER (or SUPER_ADMIN) assign any staff member to
-- a table, and lets a STAFF member assign THEMSELVES. Implemented as a
-- SECURITY DEFINER function so staff do not get general write access to
-- restaurant_tables (RENAME/delete etc. stays OWNER/MANAGER-only via RLS).

CREATE OR REPLACE FUNCTION public.claim_table_staff(target_table_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_restaurant_id UUID;
BEGIN
  SELECT restaurant_id INTO target_restaurant_id
  FROM public.restaurant_tables
  WHERE id = target_table_id;

  IF target_restaurant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT (
    public.is_platform_admin()
    OR public.has_restaurant_role(target_restaurant_id, ARRAY['OWNER', 'MANAGER'])
    OR (auth.uid() = target_user_id AND public.is_restaurant_member(target_restaurant_id))
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  UPDATE public.restaurant_tables
  SET assigned_staff_id = target_user_id
  WHERE id = target_table_id;

  RETURN FOUND;
END;
$$;
