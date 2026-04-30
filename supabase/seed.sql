-- Seed data for local development.
--
-- Populated against the declarative schema in supabase/schemas/. Kept minimal
-- so `supabase db reset` is fast. Add a row here only when there is no
-- automated way to reach the state you need for development or Playwright.
--
-- Real seed content lands with M1 (database schema milestone).

-- Marker so we can verify the seed ran in tests.
do $$
begin
  raise notice 'kizuna seed.sql executed at %', now();
end
$$;
