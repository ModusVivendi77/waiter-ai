-- Sequential per-restaurant order numbers for human-friendly references
-- ("Order 89" instead of a truncated UUID). Assigned by a BEFORE INSERT
-- trigger, serialized per restaurant via an advisory lock so concurrent
-- orders never collide.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Backfill existing orders in per-restaurant chronological order.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY restaurant_id ORDER BY created_at, id) AS rn
  FROM public.orders
)
UPDATE public.orders o
SET order_number = ranked.rn
FROM ranked
WHERE o.id = ranked.id
  AND o.order_number IS NULL;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.restaurant_id::text)::bigint);
  NEW.order_number := COALESCE(
    (SELECT MAX(order_number) FROM public.orders WHERE restaurant_id = NEW.restaurant_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_assign_order_number ON public.orders;
CREATE TRIGGER orders_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

ALTER TABLE public.orders
  ALTER COLUMN order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_restaurant_order_number
  ON public.orders(restaurant_id, order_number);
