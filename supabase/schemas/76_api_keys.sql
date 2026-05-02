-- Personal access tokens for the external Kizuna CLI and MCP surfaces.
-- Cleartext PATs are returned exactly once by create_api_key(); only a
-- deterministic SHA-256 hash is stored for verification.

create table public.api_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  scope public.api_key_scope not null,
  token_hash text not null,
  token_last4 text not null,
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip inet,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index api_keys_token_hash_unique on public.api_keys(token_hash);
create index api_keys_user_active on public.api_keys(user_id) where revoked_at is null;

-- Defense in depth: 90_rls.sql also enables RLS via a catch-all loop,
-- but stating it explicitly here makes the security boundary obvious to
-- anyone reading the table definition.
alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;

create table public.oauth_codes (
  code text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  scope public.api_key_scope not null,
  state text not null,
  redirect text not null,
  expires_at timestamptz not null default now() + interval '60 seconds',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_codes_user_idx on public.oauth_codes(user_id);

alter table public.oauth_codes enable row level security;
alter table public.oauth_codes force row level security;

create or replace function public.hash_api_key(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function public.create_api_key(
  p_name text,
  p_scope public.api_key_scope,
  p_expires_at timestamptz default null
)
returns table(id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_scope = 'admin' and not public.is_admin() then
    raise exception 'admin_scope_requires_admin';
  end if;

  v_token := 'kzn_' || p_scope::text || '_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.api_keys (user_id, name, scope, token_hash, token_last4, expires_at)
  values (
    v_user_id,
    trim(p_name),
    p_scope,
    public.hash_api_key(v_token),
    right(v_token, 4),
    p_expires_at
  )
  returning api_keys.id into v_id;

  id := v_id;
  token := v_token;
  return next;
end
$$;

create or replace function public.revoke_api_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_keys
  set revoked_at = coalesce(revoked_at, now())
  where id = p_id and user_id = auth.uid();
end
$$;

create or replace function public.verify_api_key(p_token text, p_ip inet default null)
returns table(api_key_id uuid, user_id uuid, scope public.api_key_scope)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('kizuna.allow_api_key_internal_update', 'on', true);
  return query
  update public.api_keys k
  set last_used_at = now(),
      last_used_ip = coalesce(p_ip, last_used_ip)
  where k.token_hash = public.hash_api_key(p_token)
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now())
  returning k.id, k.user_id, k.scope;
end
$$;

create or replace function public.mint_oauth_code(
  p_scope public.api_key_scope,
  p_state text,
  p_redirect text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_scope = 'admin' and not public.is_admin() then
    raise exception 'admin_scope_requires_admin';
  end if;

  v_code := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.oauth_codes (code, user_id, scope, state, redirect)
  values (v_code, v_user_id, p_scope, p_state, p_redirect);
  return v_code;
end
$$;

create or replace function public.exchange_oauth_code(p_code text, p_state text)
returns table(id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code public.oauth_codes%rowtype;
  v_token text;
  v_id uuid;
begin
  select *
    into v_code
  from public.oauth_codes
  where code = p_code
    and state = p_state
    and consumed_at is null
    and expires_at > now()
  for update;

  if v_code.code is null then
    raise exception 'invalid_oauth_code';
  end if;

  v_token := 'kzn_' || v_code.scope::text || '_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.api_keys (user_id, name, scope, token_hash, token_last4)
  values (
    v_code.user_id,
    'OAuth client',
    v_code.scope,
    public.hash_api_key(v_token),
    right(v_token, 4)
  )
  returning api_keys.id into v_id;

  update public.oauth_codes set consumed_at = now() where code = v_code.code;

  id := v_id;
  token := v_token;
  return next;
end
$$;

create or replace function public.guard_api_key_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('kizuna.allow_api_key_internal_update', true) = 'on' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.name is distinct from old.name
    or new.scope is distinct from old.scope
    or new.token_hash is distinct from old.token_hash
    or new.token_last4 is distinct from old.token_last4
    or new.expires_at is distinct from old.expires_at
    or new.last_used_at is distinct from old.last_used_at
    or new.last_used_ip is distinct from old.last_used_ip
    or new.created_at is distinct from old.created_at
  then
    raise exception 'api_keys_only_revoked_at_is_user_updatable';
  end if;
  return new;
end
$$;

create trigger api_keys_guard_update
before update on public.api_keys
for each row execute function public.guard_api_key_update();
