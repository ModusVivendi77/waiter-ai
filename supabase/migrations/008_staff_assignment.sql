-- Staff assignment & performance attribution.
--
-- 1. restaurant_tables.assigned_staff_id — connect a staff member to a table
--    so owners/managers can plan coverage and attribute table-level work.
-- 2. orders.waiter_id — record which staff member handled/served an order.
--    Together these unlock staff performance analytics (orders handled,
--    revenue served, tables covered, average order value).
--
-- RLS: no new policies needed. restaurant_tables SELECT already allows
-- restaurant members, and OWNER/MANAGER manage tables (covers assigned_staff_id
-- updates). orders UPDATE already allows restaurant staff (covers waiter_id).

ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_assigned_staff
  ON public.restaurant_tables(assigned_staff_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_waiter
  ON public.orders(waiter_id);
