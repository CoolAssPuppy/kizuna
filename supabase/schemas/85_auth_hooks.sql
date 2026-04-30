-- Auth hooks
--
-- Supabase Auth runs Custom Access Token Hooks on every JWT issuance. We use
-- one to inject `app_role` from public.users.role so RLS policies have a
-- single, consistent source of truth.
--
-- Wire this in `supabase/config.toml` under [auth.hook.custom_access_token].

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_claims jsonb;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  select role into v_role from public.users where id = v_user_id;

  if v_role is not null then
    v_claims := jsonb_set(v_claims, '{app_role}', to_jsonb(v_role::text));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
