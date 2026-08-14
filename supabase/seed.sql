-- Waiter AI — Green Bar test seed
-- ============================================================================
-- Creates / updates the "Green Bar" test restaurant with:
--   * 10 tables (Table 1-3 keep their original QR tokens so existing E2E
--     tests and printed QR codes keep working)
--   * a 5-category menu with 14 items
--   * 3 STAFF accounts: staff1@greenbar.test, staff2@greenbar.test,
--     staff3@greenbar.test — password for all three: GreenBar2026!
--
-- Run from the Supabase SQL editor (or `psql`) against the linked project.
-- The script is idempotent: it is safe to re-run.

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Restaurant --------------------------------------------------------------

INSERT INTO public.restaurants (name, slug, currency, timezone, active)
VALUES ('The Green Bar', 'the-green-bar', 'EUR', 'Europe/Athens', TRUE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active;

-- 2) Tables (10) --------------------------------------------------------------

INSERT INTO public.restaurant_tables (restaurant_id, name, qr_token, active)
SELECT r.id, seed.name, seed.qr_token, TRUE
FROM public.restaurants r
CROSS JOIN (
  VALUES
    ('Table 1', 'X7k91Lm'),
    ('Table 2', 'Pq83Za1'),
    ('Table 3', 'V9k2Hn8'),
    ('Table 4', 'M4qW8tR2'),
    ('Table 5', 'N7pZ3xL9'),
    ('Table 6', 'K2sF5vB8'),
    ('Table 7', 'Q6dJ1mC4'),
    ('Table 8', 'R3gH7nV5'),
    ('Table 9', 'T8eP4wS6'),
    ('Table 10', 'U5iK9rY7')
) AS seed(name, qr_token)
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, name) DO UPDATE
SET
  qr_token = EXCLUDED.qr_token,
  active = EXCLUDED.active;

-- 3) Menu categories (5) ------------------------------------------------------
-- The old "Food" category is renamed to "Mains" so the existing items
-- (Burger, Greek Salad) carry over instead of being duplicated.

UPDATE public.menu_categories mc
SET name = 'Mains'
FROM public.restaurants r
WHERE r.slug = 'the-green-bar'
  AND mc.restaurant_id = r.id
  AND mc.name = 'Food';

INSERT INTO public.menu_categories (restaurant_id, name, description, sort_order, active)
SELECT r.id, seed.name, seed.description, seed.sort_order, TRUE
FROM public.restaurants r
CROSS JOIN (
  VALUES
    ('Starters', 'Appetizers and small plates', 1),
    ('Mains', 'Burgers, salads, and comfort food', 2),
    ('Sides', 'Salads, potatoes, and extras', 3),
    ('Desserts', 'Sweet endings', 4),
    ('Drinks', 'Beer, wine, soft drinks, and coffee', 5)
) AS seed(name, description, sort_order)
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- 4) Menu items (14) ----------------------------------------------------------

INSERT INTO public.menu_items (
  category_id,
  restaurant_id,
  name,
  description,
  price,
  available,
  sort_order
)
SELECT
  mc.id,
  mc.restaurant_id,
  seed.name,
  seed.description,
  seed.price,
  TRUE,
  seed.sort_order
FROM public.menu_categories mc
JOIN (
  VALUES
    ('Starters', 'Tzatziki & Pita', 'Yogurt, cucumber, garlic dip with warm pita', 5.50::NUMERIC(10,2), 1),
    ('Starters', 'Fried Calamari', 'Crispy squid rings with lemon and mayo', 8.00::NUMERIC(10,2), 2),
    ('Starters', 'Halloumi Fries', 'Grilled halloumi fingers with honey', 6.50::NUMERIC(10,2), 3),
    ('Mains', 'Burger', 'Beef burger with fries', 12.00::NUMERIC(10,2), 1),
    ('Mains', 'Greek Salad', 'Tomatoes, cucumber, feta, olives', 8.50::NUMERIC(10,2), 2),
    ('Mains', 'Chicken Souvlaki', 'Skewers with pita, tzatziki, and fries', 11.00::NUMERIC(10,2), 3),
    ('Mains', 'Spaghetti Carbonara', 'Creamy pasta with pancetta and egg', 10.50::NUMERIC(10,2), 4),
    ('Sides', 'Hand-cut Fries', 'Golden fried potatoes with oregano', 3.50::NUMERIC(10,2), 1),
    ('Sides', 'Village Bread', 'Warm crusty bread with olive oil', 2.00::NUMERIC(10,2), 2),
    ('Desserts', 'Baklava', 'Layered filo with walnuts and syrup', 4.50::NUMERIC(10,2), 1),
    ('Desserts', 'Ice Cream Sundae', 'Vanilla, chocolate sauce, and whipped cream', 5.00::NUMERIC(10,2), 2),
    ('Drinks', 'Mythos', 'Greek lager', 4.00::NUMERIC(10,2), 1),
    ('Drinks', 'Espresso', 'Single shot espresso', 2.50::NUMERIC(10,2), 2),
    ('Drinks', 'Fresh Orange Juice', 'Squeezed to order', 3.50::NUMERIC(10,2), 3)
) AS seed(category_name, name, description, price, sort_order)
  ON seed.category_name = mc.name
WHERE mc.restaurant_id = (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'the-green-bar'
)
  AND NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.restaurant_id = mc.restaurant_id
      AND mi.category_id = mc.id
      AND mi.name = seed.name
  );

-- 5) Staff (3 test accounts) ---------------------------------------------------
-- Creates confirmed auth users (so they can sign in directly) and links them
-- to Green Bar as STAFF. Kept last so a failure here never blocks the menu /
-- tables seed above. Existing rows are left untouched (idempotent).

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  seed.email,
  crypt('GreenBar2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
FROM (
  VALUES
    ('staff1@greenbar.test'),
    ('staff2@greenbar.test'),
    ('staff3@greenbar.test')
) AS seed(email)
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE lower(u.email) = lower(seed.email)
);

INSERT INTO public.restaurant_users (restaurant_id, user_id, role)
SELECT r.id, u.id, 'STAFF'
FROM public.restaurants r
JOIN auth.users u
  ON u.email IN ('staff1@greenbar.test', 'staff2@greenbar.test', 'staff3@greenbar.test')
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, user_id) DO NOTHING;

