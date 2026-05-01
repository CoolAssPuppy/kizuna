-- Infrastructure tables
--
-- Reports, notifications, sync logs, and conflict tracking. These power
-- admin operations and integration reconciliation.

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  report_type report_type not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.users(id) on delete set null,
  share_token text,
  share_expires_at timestamptz,
  notes text
);

comment on table public.report_snapshots is
  'Live shareable reports. Recipients always see current data plus a last_modified column. Reports are never static exports.';
comment on column public.report_snapshots.share_token is
  'Signed token for read-only shareable link. Issued for hotel/transport recipients.';

create index report_snapshots_event_type_idx on public.report_snapshots(event_id, report_type);
create unique index report_snapshots_share_token_idx
  on public.report_snapshots(share_token) where share_token is not null;


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
