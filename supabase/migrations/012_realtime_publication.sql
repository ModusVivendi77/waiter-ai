-- Enable Postgres CDC for the application tables used by postgres_changes
-- realtime subscriptions (staff orders workspace, new-order notifications,
-- home dashboard live orders/tables).
--
-- The supabase_realtime publication previously contained only the broadcast
-- messages tables, so postgres_changes events were never delivered to
-- subscribers. REPLICA IDENTITY FULL ensures UPDATE/DELETE events carry the
-- full row so RLS filtering (is_restaurant_member) works.

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_sessions;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE public.dining_sessions REPLICA IDENTITY FULL;
