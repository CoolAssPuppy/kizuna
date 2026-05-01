-- Core identity tables
--
-- users mirrors auth.users with our app role and provenance fields.
-- A user is either an employee (sso, hibob_id non-null) or a guest
-- (email_password, sponsor_id non-null). Admins and super_admins are
-- elevated employees — they still carry the underlying employee profile.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  role user_role not null default 'employee',
  is_leadership boolean not null default false,
  hibob_id text unique,
  sponsor_id uuid references public.users(id) on delete set null,
  auth_provider auth_provider not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table public.users is
  'Core identity. References auth.users 1:1. Role and provenance live here.';
comment on column public.users.is_active is
  'False when HiBob signals termination. Auto-deprovisioned within one sync cycle.';
comment on column public.users.sponsor_id is
  'For role=guest, the employee who invited this guest. Null for employees.';
comment on column public.users.is_leadership is
  'Orthogonal to role. A guest investor or an employee VP can both be flagged. Only admins/super_admins can set this; enforced by the users_leadership_change_guard trigger.';

-- Constraint: a guest must have a sponsor; a non-guest must not.
alter table public.users
  add constraint users_guest_must_have_sponsor
  check (
    (role = 'guest' and sponsor_id is not null)
    or (role <> 'guest' and sponsor_id is null)
  );

create index users_role_idx on public.users(role) where is_active;
create index users_sponsor_id_idx on public.users(sponsor_id) where sponsor_id is not null;
create index users_leadership_idx on public.users(is_leadership) where is_leadership;


-- Employee profiles. Most fields are sourced from HiBob with field_source
-- markers. preferred_name is always user-entered (badge display name).
create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  preferred_name text,
  first_name text,
  middle_initial text check (middle_initial is null or length(middle_initial) <= 3),
  last_name text,
  legal_name text,
  legal_name_source field_source_type not null default 'hibob',
  legal_name_locked boolean not null default false,
  alternate_email citext,
  phone_number text,
  whatsapp text,
  department text,
  team text,
  job_title text,
  start_date date,
  home_country text check (home_country is null or length(home_country) = 2),
  base_city text,
  slack_handle text,
  avatar_url text,
  years_attended int not null default 0 check (years_attended >= 0),
  hibob_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on column public.employee_profiles.first_name is
  'Given name. Free-form; kept distinct from legal_name so the UI can offer a clean split.';
comment on column public.employee_profiles.middle_initial is
  'Optional middle initial (1–3 chars to allow up to "M.J.").';
comment on column public.employee_profiles.last_name is
  'Family name.';
comment on column public.employee_profiles.alternate_email is
  'Personal contact when @kizuna.dev is unreachable. citext for case-insensitive equality.';
comment on column public.employee_profiles.phone_number is
  'E.164 form preferred (+1 415 555 0101). Validation lives at the application layer.';
comment on column public.employee_profiles.whatsapp is
  'WhatsApp handle or number. Kept separate so locale-specific WhatsApp aliases are first-class.';

comment on table public.employee_profiles is
  'Per-employee profile. Fields originating from HiBob carry _source and _locked companions.';
comment on column public.employee_profiles.preferred_name is
  'Badge display name. Always user-entered, never synced from HiBob.';
comment on column public.employee_profiles.years_attended is
  'Computed from event attendance history. Not user-editable.';

create index employee_profiles_department_idx on public.employee_profiles(department);


-- Guest profiles. Linked to the sponsoring employee. Payment lifecycle.
-- This table only ever holds ADULT guests (18+). Under-18 dependents
-- live on additional_guests and never get a Kizuna login.
create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  sponsor_id uuid not null references public.users(id) on delete restrict,
  full_name text not null,
  legal_name text not null,
  relationship guest_relationship not null,
  age_bracket guest_age_bracket not null default 'adult'
    check (age_bracket = 'adult'),
  payment_status guest_payment_status not null default 'pending',
  stripe_payment_id text,
  fee_amount numeric(10, 2) check (fee_amount is null or fee_amount >= 0),
  perk_profile_created boolean not null default false,
  syncs_with_sponsor boolean not null default false
);

comment on column public.guest_profiles.syncs_with_sponsor is
  'When true, the guest sees the sponsoring employee''s itinerary instead of (or in addition to) their own. Cleared by the sponsor''s travel team if they want the guest to maintain a separate plan.';

comment on table public.guest_profiles is
  'Each guest is tied to one sponsoring employee. Payment status reconciled by Stripe webhook.';

create index guest_profiles_sponsor_id_idx on public.guest_profiles(sponsor_id);
create index guest_profiles_payment_status_idx on public.guest_profiles(payment_status);


-- Guest invitations: pre-account state for ADULT guests (18+).
-- Under-18 dependents skip this table entirely — the sponsor adds them
-- as additional_guests rows in the same flow.
create table public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.users(id) on delete cascade,
  guest_email citext not null,
  full_name text not null,
  age_bracket guest_age_bracket not null default 'adult'
    check (age_bracket = 'adult'),
  fee_amount numeric(10, 2) not null check (fee_amount >= 0),
  signed_token text not null,
  status guest_invitation_status not null default 'pending',
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_user_id uuid references public.users(id) on delete set null
);

comment on table public.guest_invitations is
  'Invitation lifecycle for adult guests. signed_token expires in 7 days. Once accepted, created_user_id points to the new guest user. fee_amount is captured at invite time so the Stripe checkout total stays stable across price changes.';

create index guest_invitations_sponsor_id_idx on public.guest_invitations(sponsor_id);
create index guest_invitations_status_idx on public.guest_invitations(status);


-- Additional guests an employee is bringing — children and other
-- under-18 dependents. Adults with their own login live in
-- public.guest_profiles, which carries CHECK (age_bracket = 'adult').
-- Under-18 rows here are private-by-default minor profiles editable
-- only by the sponsor and the sponsor's adult guests (see RLS).
create table public.additional_guests (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.users(id) on delete cascade,
  full_name text not null,
  legal_name text,
  age_bracket guest_age_bracket not null
    check (age_bracket in ('under_12', 'teen')),
  fee_amount numeric(10, 2) not null check (fee_amount >= 0),
  payment_status guest_payment_status not null default 'pending',
  stripe_payment_id text,
  dietary_restrictions text[] not null default '{}',
  special_needs text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);

comment on table public.additional_guests is
  'Under-18 dependents accompanying a sponsoring employee. Stored separately from guest_profiles because they have no auth user — the sponsor (and the sponsor''s adult guests) edit the row directly. The age_bracket CHECK keeps adult flows in guest_profiles, which prevents an under-12 row from ever ending up with a login.';
comment on column public.additional_guests.fee_amount is
  'Captured at invite time from guest_fee_for_bracket(age_bracket). Stays stable across pricing changes so a partial Stripe charge can never under-bill the sponsor.';

create index additional_guests_sponsor_id_idx on public.additional_guests(sponsor_id);


-- Accessibility preferences. Captures any accommodations the attendee
-- needs (mobility aids, sensory needs, dietary aside, etc.) so the events
-- team can plan room layouts, signage, and on-site support.
create table public.accessibility_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  needs text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);

comment on table public.accessibility_preferences is
  'Per-attendee accessibility requirements. needs is a free-form array of tags (mobility, vision, hearing, neurodivergent, other). notes carries any specifics the events team should know.';


-- Emergency contacts. One required for every attendee.
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone_primary text not null,
  phone_secondary text,
  email citext,
  notes text,
  unique (user_id)
);

comment on column public.emergency_contacts.phone_primary is
  'With country code. Validation enforced at the application layer.';
