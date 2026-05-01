set search_path to public, tap, extensions;
-- Anyone authenticated can create a channel. Only the creator (or an
-- admin) can rename or archive it. System channels are admin-only.
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000060', 'creator@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000061', 'random@example.com',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000062', 'admin@example.com',   'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-000000000060', 'creator@example.com', 'employee', 'h_create', null, 'sso'),
  ('00000000-0000-0000-0000-000000000061', 'random@example.com',  'employee', 'h_rand',   null, 'sso'),
  ('00000000-0000-0000-0000-000000000062', 'admin@example.com',   'admin',    'h_admin',  null, 'sso');

-- Sign in as creator: insert succeeds when created_by matches auth.uid()
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000060","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select lives_ok(
  $$insert into public.channels (slug, name, created_by, is_system)
    values ('rls-test-channel', 'RLS test channel', '00000000-0000-0000-0000-000000000060', false)$$,
  'employee can create a non-system channel they own'
);

-- A different employee cannot rename someone else's channel
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000061","role":"authenticated","app_role":"employee","aud":"authenticated"}';
-- The update silently affects 0 rows (RLS hides the offending row).
update public.channels set name = 'Hijacked' where slug = 'rls-test-channel';
select is(
  (select name from public.channels where slug = 'rls-test-channel'),
  'RLS test channel',
  'non-creator update is rejected by RLS'
);

-- Admin can rename anyone's channel
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000062","role":"authenticated","app_role":"admin","aud":"authenticated"}';
update public.channels set name = 'RLS test channel renamed' where slug = 'rls-test-channel';
select is(
  (select name from public.channels where slug = 'rls-test-channel'),
  'RLS test channel renamed',
  'admin can rename any channel'
);

-- Non-admin cannot insert a system channel
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000060","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select throws_ok(
  $$insert into public.channels (slug, name, created_by, is_system)
    values ('imposter-system', 'Imposter system', '00000000-0000-0000-0000-000000000060', true)$$,
  '42501',
  null,
  'is_system=true insert blocked for non-admins by RLS'
);

-- Slug constraint: invalid characters rejected
select throws_ok(
  $$insert into public.channels (slug, name, created_by)
    values ('Bad Slug!', 'Bad Slug', '00000000-0000-0000-0000-000000000060')$$,
  '23514',
  null,
  'slug check constraint rejects invalid characters'
);

select * from finish();
rollback;
