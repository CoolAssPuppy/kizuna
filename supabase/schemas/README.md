# Declarative schemas

Source of truth for the Kizuna database. Files run in alphabetical order — the
numeric prefixes encode dependency order.

```
00_extensions.sql      -- pgcrypto, citext
10_enums.sql           -- shared enum types
20_users.sql           -- core identity
30_employee_profiles.sql
40_guest_profiles.sql
...
80_rls.sql             -- RLS policies
90_triggers.sql        -- triggers and functions
```

## Workflow

```bash
# Edit a schema file in place. Then:
supabase db reset           # rebuild local DB from these schemas + seed
supabase db diff -f <name>  # generate a migration for production deploys (later)
```

Only edit declaratively — never write timestamped migrations during Phase 1.
We will switch to migration-based deploys when GitHub Actions push to staging.

## Conventions

- Snake_case for tables, columns, and functions.
- All timestamps are `timestamptz`.
- All UUIDs use `gen_random_uuid()`.
- RLS enabled on every table, no exceptions.
- One file per logical group (extensions, enums, identity, registration, ...).

See the project root `CLAUDE.md` for full data-model context.
