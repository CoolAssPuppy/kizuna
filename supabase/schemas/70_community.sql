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
  hometown_city text,
  hometown_country text check (hometown_country is null or length(hometown_country) = 2),
  current_city text,
  current_country text check (current_country is null or length(current_country) = 2),
  visibility attendee_visibility not null default 'attendees_only'
);

comment on table public.attendee_profiles is
  'Public-facing profile for connection. Sponsor-only / private modes supported.';
comment on column public.attendee_profiles.hometown_country is
  'ISO-3166-1 alpha-2. Lowercased canonical form is what the UI accepts.';
comment on column public.attendee_profiles.current_country is
  'ISO-3166-1 alpha-2 of where the user currently lives.';

create index attendee_profiles_hometown_idx
  on public.attendee_profiles(hometown_country, hometown_city)
  where hometown_country is not null;

create index attendee_profiles_current_idx
  on public.attendee_profiles(current_country, current_city)
  where current_country is not null;


-- Curated catalog of hobbies. Free-form strings are still allowed in
-- attendee_profiles.hobbies, but the catalog seeds the typeahead so dev,
-- staging, and prod databases all suggest the same set out of the box.
create table public.hobby_catalog (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  label text not null,
  category text not null
);

comment on table public.hobby_catalog is
  'Canonical hobby suggestions for the typeahead. Slug is the storage form; label is shown to the user.';


-- Channels are first-class. Any authenticated user can create one; system
-- channels (general, announcements) are flagged so they cannot be archived.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,32}$'),
  name text not null check (length(name) between 2 and 60),
  description text,
  created_by uuid references public.users(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.channels is
  'Community channels. Always public to authenticated users. DM-style routing keys (dm:uuid:uuid) are still allowed on messages.channel without a corresponding row here.';

create index channels_active_slug_idx
  on public.channels(slug)
  where archived_at is null;


create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  channel text not null,
  body text not null,
  reply_to_id uuid references public.messages(id) on delete set null,
  reactions jsonb not null default '{}'::jsonb,
  media_url text,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

comment on table public.messages is
  'Channel rows live in public.channels and are referenced by slug here. dm:{a}:{b} routing is reserved for a future DM rollout but never exposed in the UI today.';
comment on column public.messages.channel is
  'channels.slug for community channels, dm:{uuida}:{uuidb} for future DMs.';
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
