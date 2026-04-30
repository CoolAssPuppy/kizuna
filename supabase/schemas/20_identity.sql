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

-- Constraint: a guest must have a sponsor; a non-guest must not.
alter table public.users
  add constraint users_guest_must_have_sponsor
  check (
    (role = 'guest' and sponsor_id is not null)
    or (role <> 'guest' and sponsor_id is null)
  );

create index users_role_idx on public.users(role) where is_active;
create index users_sponsor_id_idx on public.users(sponsor_id) where sponsor_id is not null;


-- Employee profiles. Most fields are sourced from HiBob with field_source
-- markers. preferred_name is always user-entered (badge display name).
create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  preferred_name text,
  legal_name text,
  legal_name_source field_source_type not null default 'hibob',
  legal_name_locked boolean not null default false,
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

comment on table public.employee_profiles is
  'Per-employee profile. Fields originating from HiBob carry _source and _locked companions.';
comment on column public.employee_profiles.preferred_name is
  'Badge display name. Always user-entered, never synced from HiBob.';
comment on column public.employee_profiles.years_attended is
  'Computed from event attendance history. Not user-editable.';

create index employee_profiles_department_idx on public.employee_profiles(department);


-- Guest profiles. Linked to the sponsoring employee. Payment lifecycle.
create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  sponsor_id uuid not null references public.users(id) on delete restrict,
  full_name text not null,
  legal_name text not null,
  relationship guest_relationship not null,
  payment_status guest_payment_status not null default 'pending',
  stripe_payment_id text,
  fee_amount numeric(10, 2),
  perk_profile_created boolean not null default false
);

comment on table public.guest_profiles is
  'Each guest is tied to one sponsoring employee. Payment status reconciled by Stripe webhook.';

create index guest_profiles_sponsor_id_idx on public.guest_profiles(sponsor_id);
create index guest_profiles_payment_status_idx on public.guest_profiles(payment_status);


-- Guest invitations: pre-account state. Signed JWT in the email link.
create table public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.users(id) on delete cascade,
  guest_email citext not null,
  signed_token text not null,
  status guest_invitation_status not null default 'pending',
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_user_id uuid references public.users(id) on delete set null
);

comment on table public.guest_invitations is
  'Invitation lifecycle. signed_token expires in 7 days. Once accepted, created_user_id points to the new guest user.';

create index guest_invitations_sponsor_id_idx on public.guest_invitations(sponsor_id);
create index guest_invitations_status_idx on public.guest_invitations(status);


-- Children of employees. Age computed at event time drives meal_tier and fee.
create table public.children (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.users(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  meal_tier child_meal_tier,
  special_needs text[] not null default '{}',
  notes text
);

comment on table public.children is
  'Children of attending employees. age_at_event is computed against events.start_date in views.';

create index children_sponsor_id_idx on public.children(sponsor_id);


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
