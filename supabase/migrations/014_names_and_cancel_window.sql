-- 014: member names + customer cancellation window
-- Members should be referred to by name, not email.
ALTER TABLE public.restaurant_users
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- How long a customer may cancel an order after submitting it (minutes).
-- Owner-configurable in Setup; customers cancel from the tracking page.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cancel_window_minutes INTEGER NOT NULL DEFAULT 5;
