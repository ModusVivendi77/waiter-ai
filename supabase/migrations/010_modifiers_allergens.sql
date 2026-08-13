-- Menu modifiers, allergens, and order-line modifier snapshots.
--
-- 1. menu_items.allergens — free-form allergen labels shown to customers.
-- 2. menu_item_modifiers — optional extras per menu item (e.g. "Extra cheese"),
--    each with a price delta added to the base price at order time.
-- 3. order_items.modifiers — snapshot of the modifier names chosen for a line,
--    so the order stays stable even if the menu changes later.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.menu_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_menu_item_id
  ON public.menu_item_modifiers(menu_item_id);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS modifiers TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;

-- RLS mirrors menu_items: restaurant members can view; OWNER/MANAGER manage.
DROP POLICY IF EXISTS "Restaurant staff can view modifiers" ON public.menu_item_modifiers;
CREATE POLICY "Restaurant staff can view modifiers"
ON public.menu_item_modifiers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = menu_item_id AND public.is_restaurant_member(mi.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Managers can manage modifiers" ON public.menu_item_modifiers;
CREATE POLICY "Managers can manage modifiers"
ON public.menu_item_modifiers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = menu_item_id AND public.has_restaurant_role(mi.restaurant_id, ARRAY['OWNER', 'MANAGER'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = menu_item_id AND public.has_restaurant_role(mi.restaurant_id, ARRAY['OWNER', 'MANAGER'])
  )
);
