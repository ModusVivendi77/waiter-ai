ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS public_tracking_token TEXT;

UPDATE public.orders
SET public_tracking_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_tracking_token IS NULL;

ALTER TABLE public.orders
ALTER COLUMN public_tracking_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER TABLE public.orders
ALTER COLUMN public_tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_tracking_token
  ON public.orders(public_tracking_token);

DROP POLICY IF EXISTS "Restaurant staff can delete order items" ON public.order_items;
CREATE POLICY "Restaurant staff can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (public.is_restaurant_member(restaurant_id));
