set search_path to public, tap, extensions;
-- Pure-function tests for the domain matchers. No table fixtures
-- needed — the helpers are immutable.
begin;
select plan(12);

-- email_domain_matches: exact host
select ok(
  public.email_domain_matches('alice@supabase.io', 'supabase.io'),
  'exact host matches'
);
select ok(
  public.email_domain_matches('Alice@SUPABASE.IO', 'supabase.io'),
  'exact host is case-insensitive'
);
select ok(
  not public.email_domain_matches('alice@notsupabase.io', 'supabase.io'),
  'exact host does not match a longer host'
);
select ok(
  not public.email_domain_matches('alice@supabase.io.evil.com', 'supabase.io'),
  'exact host does not match when used as a subdomain prefix'
);

-- email_domain_matches: wildcard subdomain
select ok(
  public.email_domain_matches('a@team.supabase.io', '*.supabase.io'),
  'wildcard matches a single-label subdomain'
);
select ok(
  public.email_domain_matches('a@deep.team.supabase.io', '*.supabase.io'),
  'wildcard matches a multi-label subdomain'
);
select ok(
  not public.email_domain_matches('a@supabase.io', '*.supabase.io'),
  'wildcard does NOT match the bare host (use both rules to cover root)'
);
select ok(
  not public.email_domain_matches('a@evil.com.supabase.io.evil.com', '*.supabase.io'),
  'wildcard does NOT match when the suffix is a substring rather than a real subdomain'
);

-- Null safety
select ok(
  not public.email_domain_matches(null, 'supabase.io'),
  'null email returns false'
);
select ok(
  not public.email_domain_matches('alice@supabase.io', null),
  'null domain returns false'
);

-- email_in_domains: any-of semantics
select ok(
  public.email_in_domains('alice@kizuna.dev', ARRAY['supabase.io', 'kizuna.dev']),
  'matches when one entry in the array matches'
);
select ok(
  not public.email_in_domains('alice@elsewhere.com', ARRAY['supabase.io', 'kizuna.dev']),
  'returns false when no entry matches'
);

select * from finish();
rollback;
