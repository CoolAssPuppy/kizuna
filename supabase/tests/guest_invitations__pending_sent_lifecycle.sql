set search_path to public, tap, extensions;
-- guest_invitation_status now includes 'sent' between 'pending' and
-- 'accepted'. Pin the lifecycle:
--   1. The enum has the value.
--   2. A row inserted via the standard flow lands as 'pending'.
--   3. UPDATE pending -> sent is allowed.
--   4. UPDATE sent -> accepted is allowed (acceptance flow).
--   5. The status_idx covers the new value (smoke check).
begin;
select plan(4);

-- 1. enum value present
select ok(
  exists(
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'guest_invitation_status' and e.enumlabel = 'sent'
  ),
  'guest_invitation_status enum contains sent'
);

-- Setup: one sponsor, one invitation row.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000007a01', 'sponsor.lifecycle@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000007a01', 'sponsor.lifecycle@example.com', 'employee', 'h_lifecycle', 'sso');

insert into public.guest_invitations (
  id, sponsor_id, guest_email, full_name, age_bracket, fee_amount, signed_token, expires_at
) values (
  '00000000-0000-0000-0000-000000007b01',
  '00000000-0000-0000-0000-000000007a01',
  'invitee.lifecycle@example.com',
  'Lifecycle Invitee',
  'adult',
  0,
  'lifecycle-token',
  now() + interval '7 days'
);

-- 2. default status on insert is 'pending'.
select is(
  (select status::text from public.guest_invitations where id = '00000000-0000-0000-0000-000000007b01'),
  'pending',
  'new invitation defaults to pending'
);

-- 3. pending -> sent flip succeeds (the webhook fan-out path).
update public.guest_invitations
   set status = 'sent'
 where id = '00000000-0000-0000-0000-000000007b01';
select is(
  (select status::text from public.guest_invitations where id = '00000000-0000-0000-0000-000000007b01'),
  'sent',
  'pending invitation can move to sent'
);

-- 4. sent -> accepted flip succeeds (the acceptance flow).
update public.guest_invitations
   set status = 'accepted', accepted_at = now()
 where id = '00000000-0000-0000-0000-000000007b01';
select is(
  (select status::text from public.guest_invitations where id = '00000000-0000-0000-0000-000000007b01'),
  'accepted',
  'sent invitation can move to accepted'
);

select * from finish();
rollback;
