set search_path to public, tap, extensions;
-- Session proposals and proposal votes.
--
-- Covers:
--   1. Any authenticated user can insert a session with status='proposed'
--      pointing at themselves as proposed_by.
--   2. Non-admins cannot insert active sessions.
--   3. Non-admins cannot promote a proposal (UPDATE status -> active).
--   4. Admins can promote proposals.
--   5. Demoting an active session back to 'proposed' clears any
--      session_registrations + materialised itinerary_items rows.
--   6. Voting once is allowed; the unique constraint blocks a second vote
--      from the same user, and there is no policy that lets a user
--      DELETE their own vote (votes are one-way).
--   7. Anyone authenticated can read vote counts.

begin;
select plan(15);

-- Two attendees + one admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000aa01', 'pgtap.prop.alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000aa02', 'pgtap.prop.bob@example.com',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000aa03', 'pgtap.prop.admin@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-00000000aa01', 'pgtap.prop.alice@example.com', 'employee',    'h_prop_alice', 'sso'),
  ('00000000-0000-0000-0000-00000000aa02', 'pgtap.prop.bob@example.com',   'employee',    'h_prop_bob',   'sso'),
  ('00000000-0000-0000-0000-00000000aa03', 'pgtap.prop.admin@example.com', 'admin',       'h_prop_admin', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active, time_zone)
values ('00000000-0000-0000-0000-0000000000ef', 'Proposals Event', 'company_offsite',
        current_date, current_date + 3, false, 'America/Edmonton');

-- ---------------------------------------------------------------------
-- 1. Authenticated user can insert a proposal.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select lives_ok(
  $$insert into public.sessions
       (id, event_id, title, type, audience, status, proposed_by, abstract)
     values
       ('00000000-0000-0000-0000-00000000ee01',
        '00000000-0000-0000-0000-0000000000ef',
        'Talk: pg_extension safari', 'breakout', 'all',
        'proposed', '00000000-0000-0000-0000-00000000aa01',
        'A tour of three lesser-known extensions.')$$,
  'attendee can insert their own proposed session'
);

-- 2. Attendee cannot insert an active session.
select throws_ok(
  $$insert into public.sessions
       (event_id, title, type, audience, status, starts_at, ends_at)
     values
       ('00000000-0000-0000-0000-0000000000ef',
        'Sneaky active session', 'breakout', 'all',
        'active',
        '2027-04-01 09:00:00+00', '2027-04-01 10:00:00+00')$$,
  '42501',
  null,
  'attendee cannot insert active session'
);

-- 3. Attendee cannot promote a proposal — the proposer-update policy's
-- WITH CHECK clause rejects status='active' on their own proposal.
select throws_ok(
  $$update public.sessions
       set status = 'active',
           starts_at = '2027-04-01 09:00:00+00',
           ends_at = '2027-04-01 10:00:00+00'
     where id = '00000000-0000-0000-0000-00000000ee01'$$,
  '42501',
  null,
  'proposer cannot self-promote to active'
);

-- ---------------------------------------------------------------------
-- 4. Voting: bob votes once, second insert raises unique violation.
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa02","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select lives_ok(
  $$insert into public.session_proposal_votes (session_id, user_id)
    values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000aa02')$$,
  'bob can vote for alice''s proposal'
);

select throws_ok(
  $$insert into public.session_proposal_votes (session_id, user_id)
    values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000aa02')$$,
  '23505',
  null,
  'second vote from same user blocked by unique constraint'
);

-- A vote on someone else's behalf is rejected by RLS.
select throws_ok(
  $$insert into public.session_proposal_votes (session_id, user_id)
    values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000aa01')$$,
  '42501',
  null,
  'cannot vote on behalf of another user'
);

-- 5. Read access: anyone authenticated can read vote rows. Bob sees his own.
select is(
  (select count(*)::int from public.session_proposal_votes
    where session_id = '00000000-0000-0000-0000-00000000ee01'),
  1,
  'authenticated user reads vote counts'
);

-- 6. Vote delete is silently no-op'd by RLS (no DELETE policy is defined).
delete from public.session_proposal_votes
 where session_id = '00000000-0000-0000-0000-00000000ee01'
   and user_id = '00000000-0000-0000-0000-00000000aa02';

select is(
  (select count(*)::int from public.session_proposal_votes
    where session_id = '00000000-0000-0000-0000-00000000ee01'
      and user_id = '00000000-0000-0000-0000-00000000aa02'),
  1,
  'vote row survives DELETE attempt by owner (no DELETE policy)'
);

-- ---------------------------------------------------------------------
-- 7. Admin promotes the proposal -> active. Itinerary materialisation
--    only kicks in once a session_registration is created against an
--    active session, so we also exercise the demote path.
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa03","role":"authenticated","app_role":"admin","aud":"authenticated"}';

select lives_ok(
  $$update public.sessions
       set status = 'active',
           starts_at = '2027-04-01 09:00:00+00',
           ends_at = '2027-04-01 10:00:00+00',
           location = 'Banff hall A',
           capacity = 80
     where id = '00000000-0000-0000-0000-00000000ee01'$$,
  'admin can promote proposal to active'
);

-- Bob registers, which should produce one itinerary_item.
reset role;
insert into public.session_registrations (session_id, user_id)
values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000aa02');

select is(
  (select count(*)::int from public.itinerary_items
    where source_id = '00000000-0000-0000-0000-00000000ee01'
      and user_id = '00000000-0000-0000-0000-00000000aa02'),
  1,
  'registration on active session materialises itinerary row'
);

-- Demote the session back to proposed. Trigger should clear the
-- session_registration and the itinerary row.
update public.sessions
   set status = 'proposed'
 where id = '00000000-0000-0000-0000-00000000ee01';

select is(
  (select count(*)::int from public.itinerary_items
    where source_id = '00000000-0000-0000-0000-00000000ee01'),
  0,
  'demoting an active session clears materialised itinerary rows'
);

-- ---------------------------------------------------------------------
-- Proposer edit/delete own proposal — covered by sessions_propose_self_update
-- and sessions_propose_self_delete policies.
-- ---------------------------------------------------------------------
-- A new proposal owned by alice for the next set of assertions.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated","app_role":"employee","aud":"authenticated"}';
insert into public.sessions
  (id, event_id, title, type, audience, status, proposed_by, abstract)
values
  ('00000000-0000-0000-0000-00000000ee02',
   '00000000-0000-0000-0000-0000000000ef',
   'Talk: query plans 101', 'breakout', 'all',
   'proposed', '00000000-0000-0000-0000-00000000aa01',
   'EXPLAIN ANALYZE for the rest of us.');

select lives_ok(
  $$update public.sessions
       set title = 'Talk: query plans, 101',
           abstract = 'EXPLAIN ANALYZE for the rest of us. v2.'
     where id = '00000000-0000-0000-0000-00000000ee02'$$,
  'proposer can edit their own proposal'
);

-- Bob cannot edit alice's proposal.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa02","role":"authenticated","app_role":"employee","aud":"authenticated"}';
update public.sessions
   set title = 'hijacked'
 where id = '00000000-0000-0000-0000-00000000ee02';
select is(
  (select title from public.sessions where id = '00000000-0000-0000-0000-00000000ee02'),
  'Talk: query plans, 101',
  'non-owner update of a proposal silently affects zero rows'
);

-- Tags: default General Session tag exists for the event.
select is(
  (select count(*)::int from public.session_tags
    where event_id = '00000000-0000-0000-0000-0000000000ef'
      and name = 'General Session'),
  1,
  'default tags are pre-populated on event insert'
);

-- Alice can delete her own proposal.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated","app_role":"employee","aud":"authenticated"}';
delete from public.sessions where id = '00000000-0000-0000-0000-00000000ee02';
select is(
  (select count(*)::int from public.sessions where id = '00000000-0000-0000-0000-00000000ee02'),
  0,
  'proposer can delete their own proposal'
);

select * from finish();
rollback;
