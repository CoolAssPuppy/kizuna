-- 2025 Supafest — Málaga, Spain
--
-- Archive event for dev mode. Demonstrates that the admin console
-- can browse historical events alongside the current one.
-- Idempotent: re-running on a populated database is safe.

do $$
declare
  v_event_id uuid := '99999999-9999-9999-9999-9999900000a5';
  v_event_name text := 'Supafest 2025';
  v_event_subtitle text := 'Málaga, Spain — completed';
  v_event_location text := 'Málaga, Spain';
  v_event_tz text := 'Europe/Madrid';
  v_start_date date := '2025-04-21';
  v_end_date date := '2025-04-25';
  v_reg_opens_at timestamptz := '2024-12-01 00:00:00+00';
  v_reg_closes_at timestamptz := '2025-03-15 23:59:59+00';
  v_hero_image_path text := null;
  v_logo_path text := null;
begin
  if exists (select 1 from public.events where id = v_event_id) then
    raise notice 'event % already seeded — skipping', v_event_name;
    return;
  end if;

  insert into public.events (
    id, name, subtitle, type, location, time_zone,
    start_date, end_date, reg_opens_at, reg_closes_at,
    is_active, hero_image_path, logo_path, invite_all_employees
  ) values (
    v_event_id, v_event_name, v_event_subtitle, 'company_offsite', v_event_location, v_event_tz,
    v_start_date, v_end_date, v_reg_opens_at, v_reg_closes_at,
    false, v_hero_image_path, v_logo_path, true
  );

  insert into public.sessions (event_id, title, subtitle, type, audience, starts_at, ends_at, location, is_mandatory, abstract, speaker_email) values
    (v_event_id, 'Opening welcome',     null, 'dinner',  'all',           '2025-04-21 19:00:00+02', '2025-04-21 22:00:00+02', 'Hotel Miramar', true,  'First night together in Málaga.', null),
    (v_event_id, 'State of Supabase',   '2025 edition', 'keynote', 'employees_only','2025-04-22 09:30:00+02', '2025-04-22 11:00:00+02', 'Main hall',    true,  'A look back at 2024 and forward to 2025.', null),
    (v_event_id, 'Beach social',        null, 'social',  'all',           '2025-04-23 18:00:00+02', '2025-04-23 22:00:00+02', 'La Malagueta',  false, 'Sundowners on the Mediterranean.',          null);
end $$;
