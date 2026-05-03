create table public.cli_audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  request_id text not null,
  command text not null,
  scope public.api_key_scope not null,
  outcome text not null check (outcome in ('ok', 'error')),
  error_code text,
  duration_ms int not null,
  ran_at timestamptz not null default now()
);

create index cli_audit_log_user_ran_at_idx on public.cli_audit_log(user_id, ran_at desc);

-- Defense in depth: 90_rls.sql also enables RLS via a catch-all loop.
alter table public.cli_audit_log enable row level security;
alter table public.cli_audit_log force row level security;

create or replace function public.write_cli_audit_log(
  p_user_id uuid,
  p_api_key_id uuid,
  p_request_id text,
  p_command text,
  p_scope public.api_key_scope,
  p_outcome text,
  p_error_code text,
  p_duration_ms int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cli_audit_log (
    user_id,
    api_key_id,
    request_id,
    command,
    scope,
    outcome,
    error_code,
    duration_ms
  )
  values (
    p_user_id,
    p_api_key_id,
    p_request_id,
    p_command,
    p_scope,
    p_outcome,
    p_error_code,
    p_duration_ms
  );
end
$$;

-- write_cli_audit_log is invoked from the cli edge function with the
-- service-role key. Letting anon or authenticated reach it via PostgREST
-- would let them forge audit rows on behalf of any user_id/api_key_id
-- pair. service_role keeps blanket EXECUTE via 99_grants.sql.
revoke all on function public.write_cli_audit_log(uuid, uuid, text, text, public.api_key_scope, text, text, int) from public, anon, authenticated;
