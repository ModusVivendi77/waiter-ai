-- Enable public order status broadcasts via Supabase Realtime.
--
-- Staff members publish status changes to a per-order broadcast channel
-- (`order-status-<orderId>`). Public customers listen on that channel without
-- authentication, so no RLS policy on the orders table is needed for anon users.
--
-- Listening to a broadcast channel is open by default. Broadcasting is gated by
-- Realtime Authorization, which requires an INSERT policy on realtime.messages.
-- The policy below requires the publisher to be a member of any restaurant so
-- anonymous visitors can never publish to a channel.

DROP POLICY IF EXISTS "Restaurant staff can broadcast order status updates" ON realtime.messages;
CREATE POLICY "Restaurant staff can broadcast order status updates"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurant_users ru
    WHERE ru.user_id = auth.uid()
  )
);