-- Fix: let every authenticated user view their own restaurant memberships.
--
-- The existing "Owners can view restaurant users" SELECT policy only allows
-- OWNERs, which breaks getClientUserContext() for STAFF/MANAGER accounts —
-- their own membership row was invisible to them, so every platform page
-- reported "You need restaurant access." Owners still see the full roster via
-- the FOR ALL policy.

DROP POLICY IF EXISTS "Users can view own memberships" ON public.restaurant_users;
CREATE POLICY "Users can view own memberships"
ON public.restaurant_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
