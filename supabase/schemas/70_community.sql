-- Community tables
--
-- Phase 2 territory but the schema is in place from M1 so RLS is in place
-- before any community feature ships.
-- attendee_profiles is the public-facing layer of an attendee. messages is
-- real-time chat via Supabase Realtime. votes powers session feedback and
-- idea boards.

create table public.attendee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  bio text,
  hobbies text[] not null default '{}',
  countries_visited text[] not null default '{}',
  languages text[] not null default '{}',
  fun_fact text,
  interests text[] not null default '{}',
  visibility attendee_visibility not null default 'attendees_only'
);

comment on table public.attendee_profiles is
  'Public-facing profile for connection. Sponsor-only / private modes supported.';


create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  channel text not null,
  body text not null,
  reply_to_id uuid references public.messages(id) on delete set null,
  reactions jsonb not null default '{}'::jsonb,
  media_url text,
  sent_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.messages is
  'Phase 1: channel is a free-text string. Phase 2: refactor to a channels table with membership records for proper group management. Known intentional simplification.';
comment on column public.messages.channel is
  'Examples: general | guests | announcements | team:{id} | dm:{user_id}.';
comment on column public.messages.reactions is
  'Lightweight emoji reactions: { "🎉": ["user-id-1", "user-id-2"] }.';

create index messages_channel_sent_at_idx on public.messages(channel, sent_at desc);
create index messages_sender_id_idx on public.messages(sender_id);


create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type vote_target_type not null,
  target_id uuid not null,
  value int not null check (value in (-1, 1)),
  unique (user_id, target_type, target_id)
);

comment on column public.votes.value is
  '+1 upvote / -1 downvote.';

create index votes_target_idx on public.votes(target_type, target_id);
