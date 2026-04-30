-- Documents and consent acknowledgements
--
-- documents stores versioned content (Kizuna-native or Notion-synced).
-- document_acknowledgements is the legal audit trail: every consent gate
-- writes one row capturing the exact version, scroll completion, IP, UA.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  document_key text not null check (
    document_key in ('waiver', 'code_of_conduct', 'expense_policy', 'booking_process', 'livestream', 'toc')
  ),
  version int not null default 1 check (version > 0),
  title text not null,
  body text not null,
  applies_to document_audience not null default 'all',
  requires_acknowledgement boolean not null default false,
  requires_scroll boolean not null default false,
  notion_page_id text,
  notion_synced_at timestamptz,
  display_order int not null default 0,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  unique (event_id, document_key, version)
);

comment on table public.documents is
  'Versioned content. Legal documents are Kizuna-native (notion_page_id null). Informational documents sync from Notion.';
comment on column public.documents.event_id is
  'Null event_id means the document applies to all events globally.';
comment on column public.documents.requires_acknowledgement is
  'True puts this document on the consent gate path. Bumping version forces re-acknowledgement.';


create table public.document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  document_key text not null,
  document_version int not null,
  acknowledged_at timestamptz not null default now(),
  ip_address text,
  scrolled_to_bottom boolean not null,
  explicit_checkbox boolean not null,
  device_type text check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')),
  unique (user_id, event_id, document_key, document_version)
);

comment on table public.document_acknowledgements is
  'Legal audit trail. One row per version per user per event. Retained for compliance.';
comment on column public.document_acknowledgements.scrolled_to_bottom is
  'True when the user reached document end before agreeing. Stronger legal signal.';
comment on column public.document_acknowledgements.explicit_checkbox is
  'True when the user ticked a checkbox before clicking I Agree.';

create index document_acknowledgements_user_event_idx
  on public.document_acknowledgements(user_id, event_id);
