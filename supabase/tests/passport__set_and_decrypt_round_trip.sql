set search_path to public, tap, extensions;
-- set_passport encrypts; get_passport_number decrypts when called by owner.
begin;
select plan(3);

set local kizuna.passport_key = 'test-key-not-for-prod';

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000aa', 'alice@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000000aa', 'alice@example.com', 'employee', 'hibob_aa', 'sso');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated","app_role":"employee","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';

-- Act
select public.set_passport(
  '00000000-0000-0000-0000-0000000000aa'::uuid,
  'ALICE EXAMPLE',
  'X1234567',
  'US',
  '2030-01-01'::date
);

-- Assert: row exists with encrypted bytes (not the plaintext)
select is(
  (select passport_name from public.passport_details where user_id = '00000000-0000-0000-0000-0000000000aa'),
  'ALICE EXAMPLE',
  'passport_name stored as plaintext'
);

select isnt(
  (select passport_number_encrypted::text from public.passport_details where user_id = '00000000-0000-0000-0000-0000000000aa'),
  'X1234567',
  'passport_number_encrypted is NOT plaintext'
);

-- Decrypt round-trip
select is(
  public.get_passport_number('00000000-0000-0000-0000-0000000000aa'::uuid),
  'X1234567',
  'get_passport_number decrypts to original'
);

select * from finish();
rollback;
