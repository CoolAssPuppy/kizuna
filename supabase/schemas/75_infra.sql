-- Infrastructure tables
--
-- Notifications, sync logs, and conflict tracking. These power admin
-- operations and integration reconciliation. Reports are admin-only and
-- read live from the source tables — there is no shareable snapshot.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  channel notification_channel not null,
  notification_type notification_type not null,
  task_id uuid references public.registration_tasks(id) on delete set null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  delivered boolean not null default false,
  read_at timestamptz,
  sent_by uuid references public.users(id) on delete set null
);

comment on table public.notifications is
  'Full log of every nudge and system message. Drives admin nudge dashboard and audit.';
comment on column public.notifications.read_at is
  'Set by the recipient when the in-app notification center marks it read. NULL means unread.';

create index notifications_user_id_sent_at_idx on public.notifications(user_id, sent_at desc);
create index notifications_user_unread_idx
  on public.notifications(user_id) where read_at is null;
create index notifications_task_id_idx on public.notifications(task_id) where task_id is not null;


create table public.hibob_sync_log (
  id uuid primary key default gen_random_uuid(),
  sync_started_at timestamptz not null default now(),
  sync_completed_at timestamptz,
  status sync_status not null default 'success',
  records_processed int not null default 0,
  records_updated int not null default 0,
  records_skipped int not null default 0,
  conflicts_created int not null default 0,
  error_detail jsonb
);

comment on table public.hibob_sync_log is
  'Every HiBob sync run audited. records_skipped counts user-overridden fields.';

create index hibob_sync_log_started_idx on public.hibob_sync_log(sync_started_at desc);


create table public.data_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  table_name text not null,
  field_name text not null,
  kizuna_value text,
  external_value text,
  external_source external_source_type not null,
  detected_at timestamptz not null default now(),
  status conflict_status not null default 'open',
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text
);

comment on table public.data_conflicts is
  'Field-level discrepancies between Kizuna and external sources (HiBob, Perk).';
comment on column public.data_conflicts.kizuna_value is
  'Current value in Kizuna (user-entered or admin-set).';
comment on column public.data_conflicts.external_value is
  'Value the external source is asserting.';

create index data_conflicts_user_status_idx on public.data_conflicts(user_id, status);
create index data_conflicts_status_open_idx on public.data_conflicts(status) where status = 'open';


-- =====================================================================
-- Icebreaker rephrase cache
-- =====================================================================
-- gpt-4o-mini-rephrased questions for the home "Get to know your
-- teammate" card. Keying by a normalised fact (lowercase + trimmed)
-- de-duplicates "I love chess." vs "I love chess" vs "  i love
-- chess.". We never re-call the model for a fact we've seen before.
create table public.icebreaker_rephrasings (
  fact_key text primary key check (length(fact_key) between 3 and 1000),
  fact_original text not null,
  question text not null,
  model text,
  created_at timestamptz not null default now()
);

comment on table public.icebreaker_rephrasings is
  'OpenAI rephrase cache for the Get-to-know-your-teammate home card. fact_key is the normalised (lowercase + trimmed + trailing-punctuation-stripped) version of the fact; fact_original keeps the original cased text for reference. Read by the rephrase-icebreaker edge function before any external call.';
