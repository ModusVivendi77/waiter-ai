CREATE TABLE IF NOT EXISTS public.platform_admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admin_users pau
    WHERE pau.user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_member(target_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_users ru
      WHERE ru.restaurant_id = target_restaurant_id
        AND ru.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(target_restaurant_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_users ru
      WHERE ru.restaurant_id = target_restaurant_id
        AND ru.user_id = auth.uid()
        AND ru.role = ANY(allowed_roles)
    );
$$;

DROP POLICY IF EXISTS "Platform admins can view own assignment" ON public.platform_admin_users;
CREATE POLICY "Platform admins can view own assignment"
ON public.platform_admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
