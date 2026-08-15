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

INSERT INTO public.menu_categories (restaurant_id, name, description, name_el, description_el, sort_order, active)
SELECT r.id, seed.name, seed.description, seed.name_el, seed.description_el, seed.sort_order, TRUE
FROM public.restaurants r
CROSS JOIN (
  VALUES
    ('Starters', 'Appetizers and small plates', 'Ορεκτικά', 'Ορεκτικά και μικρά πιάτα', 1),
    ('Mains', 'Burgers, salads, and comfort food', 'Κυρίως πιάτα', 'Μπέργκερ, σαλάτες και comfort food', 2),
    ('Sides', 'Salads, potatoes, and extras', 'Συνοδευτικά', 'Σαλάτες, πατάτες και συνοδευτικά', 3),
    ('Desserts', 'Sweet endings', 'Επιδόρπια', 'Γλυκά τελειώματα', 4),
    ('Drinks', 'Beer, wine, soft drinks, and coffee', 'Ποτά', 'Μπύρα, κρασί, αναψυκτικά και καφές', 5)
) AS seed(name, description, name_el, description_el, sort_order)
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  name_el = EXCLUDED.name_el,
  description_el = EXCLUDED.description_el,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- 4) Menu items (14) ----------------------------------------------------------

INSERT INTO public.menu_items (
  category_id,
  restaurant_id,
  name,
  description,
  name_el,
  description_el,
  price,
  available,
  sort_order
)
SELECT
  mc.id,
  mc.restaurant_id,
  seed.name,
  seed.description,
  seed.name_el,
  seed.description_el,
  seed.price,
  TRUE,
  seed.sort_order
FROM public.menu_categories mc
JOIN (
  VALUES
    ('Starters', 'Tzatziki & Pita', 'Yogurt, cucumber, garlic dip with warm pita', 'Τζατζίκι & Πίτα', 'Γιαούρτι, αγγούρι, σκόρδο με ζεστή πίτα', 5.50::NUMERIC(10,2), 1),
    ('Starters', 'Fried Calamari', 'Crispy squid rings with lemon and mayo', 'Τηγανητά Καλαμάρια', 'Τραγανά καλαμάρια με λεμόνι και μαγιονέζα', 8.00::NUMERIC(10,2), 2),
    ('Starters', 'Halloumi Fries', 'Grilled halloumi fingers with honey', 'Χαλούμι Τηγανητό', 'Ψητό χαλούμι σε μπαστουνάκια με μέλι', 6.50::NUMERIC(10,2), 3),
    ('Mains', 'Burger', 'Beef burger with fries', 'Μπέργκερ', 'Μπέργκερ με πατάτες', 12.00::NUMERIC(10,2), 1),
    ('Mains', 'Greek Salad', 'Tomatoes, cucumber, feta, olives', 'Χωριάτικη Σαλάτα', 'Ντομάτες, αγγούρι, φέτα, ελιές', 8.50::NUMERIC(10,2), 2),
    ('Mains', 'Chicken Souvlaki', 'Skewers with pita, tzatziki, and fries', 'Κοτόπουλο Σουβλάκι', 'Καλαμάκια με πίτα, τζατζίκι και πατάτες', 11.00::NUMERIC(10,2), 3),
    ('Mains', 'Spaghetti Carbonara', 'Creamy pasta with pancetta and egg', 'Σπαγγέτι Καρμπονάρα', 'Κρεμώδη ζυμαρικά με πανσέτα και αυγό', 10.50::NUMERIC(10,2), 4),
    ('Sides', 'Hand-cut Fries', 'Golden fried potatoes with oregano', 'Χειροποίητες Πατάτες', 'Χρυσές τηγανητές πατάτες με ρίγανη', 3.50::NUMERIC(10,2), 1),
    ('Sides', 'Village Bread', 'Warm crusty bread with olive oil', 'Χωριάτικο Ψωμί', 'Ζεστό χωριάτικο ψωμί με ελαιόλαδο', 2.00::NUMERIC(10,2), 2),
    ('Desserts', 'Baklava', 'Layered filo with walnuts and syrup', 'Μπακλαβάς', 'Σφολιάτα με καρύδια και σιρόπι', 4.50::NUMERIC(10,2), 1),
    ('Desserts', 'Ice Cream Sundae', 'Vanilla, chocolate sauce, and whipped cream', 'Παγωτό Σαντέ', 'Βανίλια, σάλτσα σοκολάτας και σαντιγί', 5.00::NUMERIC(10,2), 2),
    ('Drinks', 'Mythos', 'Greek lager', 'Μύθος', 'Ελληνική λάγερ μπύρα', 4.00::NUMERIC(10,2), 1),
    ('Drinks', 'Espresso', 'Single shot espresso', 'Εσπρέσο', 'Μονός εσπρέσο', 2.50::NUMERIC(10,2), 2),
    ('Drinks', 'Fresh Orange Juice', 'Squeezed to order', 'Φρέσκος Χυμός Πορτοκάλι', 'Φρεσκοστυμμένος χυμός', 3.50::NUMERIC(10,2), 3)
) AS seed(category_name, name, description, name_el, description_el, price, sort_order)
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

