CREATE OR REPLACE FUNCTION public.is_restaurant_member(target_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_users ru
    WHERE ru.restaurant_id = target_restaurant_id
      AND ru.user_id = auth.uid()
      AND ru.role = ANY(allowed_roles)
  );
$$;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant staff can view restaurants" ON public.restaurants;
CREATE POLICY "Restaurant staff can view restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(id));

DROP POLICY IF EXISTS "Owners can update restaurants" ON public.restaurants;
CREATE POLICY "Owners can update restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (public.has_restaurant_role(id, ARRAY['OWNER']))
WITH CHECK (public.has_restaurant_role(id, ARRAY['OWNER']));

DROP POLICY IF EXISTS "Owners can insert restaurants" ON public.restaurants;
CREATE POLICY "Owners can insert restaurants"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Owners can view restaurant users" ON public.restaurant_users;
CREATE POLICY "Owners can view restaurant users"
ON public.restaurant_users
FOR SELECT
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER']));

DROP POLICY IF EXISTS "Owners can manage restaurant users" ON public.restaurant_users;
CREATE POLICY "Owners can manage restaurant users"
ON public.restaurant_users
FOR ALL
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER']))
WITH CHECK (public.has_restaurant_role(restaurant_id, ARRAY['OWNER']));

DROP POLICY IF EXISTS "Restaurant staff can view tables" ON public.restaurant_tables;
CREATE POLICY "Restaurant staff can view tables"
ON public.restaurant_tables
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Managers can manage tables" ON public.restaurant_tables;
CREATE POLICY "Managers can manage tables"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']))
WITH CHECK (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']));

DROP POLICY IF EXISTS "Restaurant staff can view sessions" ON public.dining_sessions;
CREATE POLICY "Restaurant staff can view sessions"
ON public.dining_sessions
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Managers can manage sessions" ON public.dining_sessions;
CREATE POLICY "Managers can manage sessions"
ON public.dining_sessions
FOR ALL
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']))
WITH CHECK (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']));

DROP POLICY IF EXISTS "Restaurant staff can view categories" ON public.menu_categories;
CREATE POLICY "Restaurant staff can view categories"
ON public.menu_categories
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Managers can manage categories" ON public.menu_categories;
CREATE POLICY "Managers can manage categories"
ON public.menu_categories
FOR ALL
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']))
WITH CHECK (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']));

DROP POLICY IF EXISTS "Restaurant staff can view menu items" ON public.menu_items;
CREATE POLICY "Restaurant staff can view menu items"
ON public.menu_items
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Managers can manage menu items" ON public.menu_items;
CREATE POLICY "Managers can manage menu items"
ON public.menu_items
FOR ALL
TO authenticated
USING (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']))
WITH CHECK (public.has_restaurant_role(restaurant_id, ARRAY['OWNER', 'MANAGER']));

DROP POLICY IF EXISTS "Restaurant staff can view orders" ON public.orders;
CREATE POLICY "Restaurant staff can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can create orders" ON public.orders;
CREATE POLICY "Restaurant staff can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can update orders" ON public.orders;
CREATE POLICY "Restaurant staff can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_restaurant_member(restaurant_id))
WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can view order items" ON public.order_items;
CREATE POLICY "Restaurant staff can view order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can create order items" ON public.order_items;
CREATE POLICY "Restaurant staff can create order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can update order items" ON public.order_items;
CREATE POLICY "Restaurant staff can update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (public.is_restaurant_member(restaurant_id))
WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "Restaurant staff can view order status history" ON public.order_status_history;
CREATE POLICY "Restaurant staff can view order status history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND public.is_restaurant_member(o.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Restaurant staff can create order status history" ON public.order_status_history;
CREATE POLICY "Restaurant staff can create order status history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND public.is_restaurant_member(o.restaurant_id)
  )
);
