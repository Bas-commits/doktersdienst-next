-- At most one preference row per (slot, user) for types 2, 3, 9, 10, 5001.
-- Prevents duplicate rows from quick double-clicks or race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS "diensten_one_preference_per_slot_user"
ON public.diensten (van, tot, idwaarneemgroep, iddeelnemer)
WHERE type IN (2, 3, 9, 10, 5001);
