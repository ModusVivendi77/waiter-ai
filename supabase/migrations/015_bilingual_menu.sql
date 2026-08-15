-- 015: bilingual menu content
-- The customer menu can be switched to Greek. Menu names and descriptions live
-- in the database, so each row gains a *_el column. NULL means "no Greek text
-- yet" — the app falls back to the default (English) value in that case.

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS name_el TEXT,
  ADD COLUMN IF NOT EXISTS description_el TEXT;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS name_el TEXT,
  ADD COLUMN IF NOT EXISTS description_el TEXT;

-- Backfill the seeded The Green Bar menu with Greek translations.
UPDATE public.menu_categories SET
  name_el = CASE name
    WHEN 'Starters' THEN 'Ορεκτικά'
    WHEN 'Mains' THEN 'Κυρίως πιάτα'
    WHEN 'Sides' THEN 'Συνοδευτικά'
    WHEN 'Desserts' THEN 'Επιδόρπια'
    WHEN 'Drinks' THEN 'Ποτά'
  END,
  description_el = CASE name
    WHEN 'Starters' THEN 'Ορεκτικά και μικρά πιάτα'
    WHEN 'Mains' THEN 'Μπέργκερ, σαλάτες και comfort food'
    WHEN 'Sides' THEN 'Σαλάτες, πατάτες και συνοδευτικά'
    WHEN 'Desserts' THEN 'Γλυκά τελειώματα'
    WHEN 'Drinks' THEN 'Μπύρα, κρασί, αναψυκτικά και καφές'
  END
WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'the-green-bar');

UPDATE public.menu_items SET
  name_el = CASE name
    WHEN 'Tzatziki & Pita' THEN 'Τζατζίκι & Πίτα'
    WHEN 'Fried Calamari' THEN 'Τηγανητά Καλαμάρια'
    WHEN 'Halloumi Fries' THEN 'Χαλούμι Τηγανητό'
    WHEN 'Burger' THEN 'Μπέργκερ'
    WHEN 'Greek Salad' THEN 'Χωριάτικη Σαλάτα'
    WHEN 'Chicken Souvlaki' THEN 'Κοτόπουλο Σουβλάκι'
    WHEN 'Spaghetti Carbonara' THEN 'Σπαγγέτι Καρμπονάρα'
    WHEN 'Hand-cut Fries' THEN 'Χειροποίητες Πατάτες'
    WHEN 'Village Bread' THEN 'Χωριάτικο Ψωμί'
    WHEN 'Baklava' THEN 'Μπακλαβάς'
    WHEN 'Ice Cream Sundae' THEN 'Παγωτό Σαντέ'
    WHEN 'Mythos' THEN 'Μύθος'
    WHEN 'Espresso' THEN 'Εσπρέσο'
    WHEN 'Fresh Orange Juice' THEN 'Φρέσκος Χυμός Πορτοκάλι'
  END,
  description_el = CASE name
    WHEN 'Tzatziki & Pita' THEN 'Γιαούρτι, αγγούρι, σκόρδο με ζεστή πίτα'
    WHEN 'Fried Calamari' THEN 'Τραγανά καλαμάρια με λεμόνι και μαγιονέζα'
    WHEN 'Halloumi Fries' THEN 'Ψητό χαλούμι σε μπαστουνάκια με μέλι'
    WHEN 'Burger' THEN 'Μπέργκερ με πατάτες'
    WHEN 'Greek Salad' THEN 'Ντομάτες, αγγούρι, φέτα, ελιές'
    WHEN 'Chicken Souvlaki' THEN 'Καλαμάκια με πίτα, τζατζίκι και πατάτες'
    WHEN 'Spaghetti Carbonara' THEN 'Κρεμώδη ζυμαρικά με πανσέτα και αυγό'
    WHEN 'Hand-cut Fries' THEN 'Χρυσές τηγανητές πατάτες με ρίγανη'
    WHEN 'Village Bread' THEN 'Ζεστό χωριάτικο ψωμί με ελαιόλαδο'
    WHEN 'Baklava' THEN 'Σφολιάτα με καρύδια και σιρόπι'
    WHEN 'Ice Cream Sundae' THEN 'Βανίλια, σάλτσα σοκολάτας και σαντιγί'
    WHEN 'Mythos' THEN 'Ελληνική λάγερ μπύρα'
    WHEN 'Espresso' THEN 'Μονός εσπρέσο'
    WHEN 'Fresh Orange Juice' THEN 'Φρεσκοστυμμένος χυμός'
  END
WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'the-green-bar');
