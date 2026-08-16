-- 016_tables_room.sql
-- Lets owners organise tables by area/room (e.g. Indoors, Outdoors, Terrace).
-- The room is a free-text label defined by the owner when creating a table.
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS room TEXT;
