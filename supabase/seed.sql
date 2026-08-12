INSERT INTO public.restaurants (name, slug, currency, timezone, active)
VALUES ('The Green Bar', 'the-green-bar', 'EUR', 'Europe/Athens', TRUE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active;

INSERT INTO public.restaurant_tables (restaurant_id, name, qr_token, active)
SELECT r.id, seed.name, seed.qr_token, TRUE
FROM public.restaurants r
CROSS JOIN (
  VALUES
    ('Table 1', 'X7k91Lm'),
    ('Table 2', 'Pq83Za1'),
    ('Table 3', 'V9k2Hn8')
) AS seed(name, qr_token)
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, name) DO UPDATE
SET
  qr_token = EXCLUDED.qr_token,
  active = EXCLUDED.active;

INSERT INTO public.menu_categories (restaurant_id, name, description, sort_order, active)
SELECT r.id, seed.name, seed.description, seed.sort_order, TRUE
FROM public.restaurants r
CROSS JOIN (
  VALUES
    ('Food', 'Main dishes and snacks', 1),
    ('Drinks', 'Beer, wine, soft drinks, and coffee', 2)
) AS seed(name, description, sort_order)
WHERE r.slug = 'the-green-bar'
ON CONFLICT (restaurant_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

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
    ('Food', 'Burger', 'Beef burger with fries', 12.00::NUMERIC(10,2), 1),
    ('Food', 'Greek Salad', 'Tomatoes, cucumber, feta, olives', 8.50::NUMERIC(10,2), 2),
    ('Drinks', 'Mythos', 'Greek lager', 4.00::NUMERIC(10,2), 1),
    ('Drinks', 'Espresso', 'Single shot espresso', 2.50::NUMERIC(10,2), 2)
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
