-- 2026 Supafest — Da Nang, Vietnam
--
-- Archive event for dev mode. Most recently completed Supafest.
-- Idempotent: re-running on a populated database is safe.

do $$
declare
  v_event_id uuid := '99999999-9999-9999-9999-9999900000a6';
  v_event_name text := 'Supafest 2026';
  v_event_subtitle text := 'Da Nang, Vietnam — completed';
  v_event_location text := 'Da Nang, Vietnam';
  v_event_tz text := 'Asia/Ho_Chi_Minh';
  v_start_date date := '2026-02-09';
  v_end_date date := '2026-02-13';
  v_reg_opens_at timestamptz := '2025-09-01 00:00:00+00';
  v_reg_closes_at timestamptz := '2025-12-15 23:59:59+00';
  v_hero_image_url text := 'https://kizuna.dev/da-nang-hero.jpg';
  v_logo_url text := 'https://kizuna.dev/supafest-2026-logo.svg';
begin
  if exists (select 1 from public.events where id = v_event_id) then
    raise notice 'event % already seeded — skipping', v_event_name;
    return;
  end if;

  insert into public.events (
    id, name, subtitle, type, location, time_zone,
    start_date, end_date, reg_opens_at, reg_closes_at,
    is_active, hero_image_url, logo_url, invite_all_employees
  ) values (
    v_event_id, v_event_name, v_event_subtitle, 'supafest', v_event_location, v_event_tz,
    v_start_date, v_end_date, v_reg_opens_at, v_reg_closes_at,
    false, v_hero_image_url, v_logo_url, true
  );

  insert into public.sessions (event_id, title, subtitle, type, audience, starts_at, ends_at, location, is_mandatory, abstract, speaker_email) values
    (v_event_id, 'Welcome banquet',     null, 'dinner',  'all',           '2026-02-09 19:00:00+07', '2026-02-09 22:00:00+07', 'InterContinental ballroom', true,  'Banh xeo and a long welcome.', null),
    (v_event_id, 'Roadmap keynote',     null, 'keynote', 'employees_only','2026-02-10 09:00:00+07', '2026-02-10 10:30:00+07', 'Main hall',                true,  'How 2025 shaped the year ahead.', null),
    (v_event_id, 'My Khe beach run',    null, 'activity','opt_in',        '2026-02-11 06:30:00+07', '2026-02-11 08:00:00+07', 'My Khe beach',             false, 'Optional 5k run along the coast.', null);
end $$;
