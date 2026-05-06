set search_path to public, tap, extensions;
-- data_conflicts is the spine of the integration story: a HiBob/Perk
-- sync writes a conflict row when an external source disagrees with a
-- user-set value. Admins read; only super_admins resolve.
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-cf00cf00cf01', 'super@conf.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-cf00cf00cf02', 'admin@conf.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-cf00cf00cf03', 'employee@conf.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-cf00cf00cf01', 'super@conf.test',    'super_admin', 'h_conf_super', null, 'sso'),
  ('00000000-0000-0000-0000-cf00cf00cf02', 'admin@conf.test',    'admin',       'h_conf_admin', null, 'sso'),
  ('00000000-0000-0000-0000-cf00cf00cf03', 'employee@conf.test', 'employee',    'h_conf_emp',   null, 'sso');

set local role authenticated;

-- Super-admin writes a conflict row.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cf00cf00cf01","role":"authenticated","app_role":"super_admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.data_conflicts (id, user_id, table_name, field_name, kizuna_value, external_value, external_source, status)
    values ('00000000-0000-0000-0000-cf00cf001001',
            '00000000-0000-0000-0000-cf00cf00cf03',
            'employee_profiles', 'first_name',
            'Lukas',
            'Luke',
            'hibob',
            'open')$$,
  'super_admin can insert a conflict'
);

-- Admin can read.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cf00cf00cf02","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  (select count(*)::int from public.data_conflicts where user_id = '00000000-0000-0000-0000-cf00cf00cf03'),
  1,
  'admin can read conflicts'
);

-- Admin cannot write.
select throws_ok(
  $$insert into public.data_conflicts (user_id, table_name, field_name, external_source, status)
    values ('00000000-0000-0000-0000-cf00cf00cf03', 'employee_profiles', 'last_name', 'hibob', 'open')$$,
  '42501',
  null,
  'admin cannot insert a conflict (super_admin-only writes)'
);

-- The owning employee cannot read their own conflicts.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cf00cf00cf03","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.data_conflicts where user_id = '00000000-0000-0000-0000-cf00cf00cf03'),
  0,
  'employee cannot read their own conflict rows (admin surface only)'
);

-- Super-admin resolves the conflict (write).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cf00cf00cf01","role":"authenticated","app_role":"super_admin","aud":"authenticated"}';
update public.data_conflicts
   set status = 'accepted_kizuna', resolved_by = '00000000-0000-0000-0000-cf00cf00cf01', resolved_at = now()
 where id = '00000000-0000-0000-0000-cf00cf001001';
select is(
  (select status::text from public.data_conflicts where id = '00000000-0000-0000-0000-cf00cf001001'),
  'accepted_kizuna',
  'super_admin can resolve a conflict'
);

select * from finish();
rollback;
