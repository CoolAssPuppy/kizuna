-- Registration tables
--
-- One registration row per user per event. Per-task checklist drives
-- completion_pct via trigger. Custom fields and responses let admins ask
-- event-specific questions without schema changes.

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status registration_status not null default 'invited',
  completion_pct int not null default 0 check (completion_pct between 0 and 100),
  checked_in_at timestamptz,
  checked_in_by uuid references public.users(id) on delete set null,
  qr_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

comment on column public.registrations.completion_pct is
  'Maintained by trigger update_registration_completion(). Never write directly from app code.';
comment on column public.registrations.qr_token is
  'Signed JWT rendered as QR code at check-in. Cached offline.';

create index registrations_event_status_idx on public.registrations(event_id, status);
create index registrations_user_id_idx on public.registrations(user_id);
create index registrations_event_user_idx on public.registrations(event_id, user_id);


create table public.registration_tasks (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  task_key registration_task_key not null,
  status registration_task_status not null default 'pending',
  applies_to task_audience not null default 'all',
  deadline timestamptz,
  completed_at timestamptz,
  is_auto_completed boolean not null default false,
  nudge_count int not null default 0 check (nudge_count >= 0),
  last_nudge_at timestamptz,
  unique (registration_id, task_key)
);

comment on column public.registration_tasks.is_auto_completed is
  'True when the system completed the task (e.g. flight task when Perk sync fires).';
comment on column public.registration_tasks.last_nudge_at is
  'Rate-limit anchor: minimum 3 days between nudges per task per user.';

create index registration_tasks_registration_id_idx on public.registration_tasks(registration_id);
create index registration_tasks_status_idx on public.registration_tasks(status);


-- Admin-defined custom fields per event.
create table public.profile_custom_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type custom_field_type not null,
  options text[] not null default '{}',
  is_required boolean not null default false,
  applies_to custom_field_audience not null default 'all',
  display_order int not null default 0,
  hint text,
  unique (event_id, field_key)
);

comment on column public.profile_custom_fields.field_key is
  'Slug used as a stable key in client code. e.g. badge_name, base_city, arrival_note.';


create table public.profile_field_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field_id uuid not null references public.profile_custom_fields(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, event_id)
);

comment on column public.profile_field_responses.value is
  'Stored as text regardless of field_type. Cast on read in client code.';


-- Passport details. Encrypted at rest with pgcrypto.
-- Insert/update via security definer function to keep encryption transparent.
create table public.passport_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  passport_name text not null,
  passport_number_encrypted bytea not null,
  issuing_country text not null check (length(issuing_country) = 2),
  expiry_date date not null,
  updated_at timestamptz not null default now()
);

comment on table public.passport_details is
  'Encrypted travel document data. passport_number_encrypted holds pgp_sym_encrypt(plain, key) bytes.';
comment on column public.passport_details.passport_number_encrypted is
  'pgcrypto pgp_sym_encrypt result. Decryption requires KIZUNA_PASSPORT_KEY (set via vault). Admins cannot SELECT this table at all.';


create table public.dietary_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  restrictions text[] not null default '{}',
  allergies text[] not null default '{}',
  alcohol_free boolean not null default false,
  severity dietary_severity not null default 'preference',
  notes text,
  updated_at timestamptz not null default now()
);

comment on column public.dietary_preferences.severity is
  'Anaphylactic risk drives kitchen flagging. Admin reports highlight allergy entries.';

create index dietary_preferences_severity_idx on public.dietary_preferences(severity);
