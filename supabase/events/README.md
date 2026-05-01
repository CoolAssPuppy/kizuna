# Event configuration

One file per Supafest year. Each file is a self-contained SQL script that
seeds everything specific to that event:

- the `public.events` row (id, dates, time zone, location)
- documents that need to be acknowledged (waiver, code of conduct, expense policy)
- the session schedule (welcome dinner, keynotes, breakouts, activities, parties)
- a starter registration row for the seed employees so the wizard has something to resume

Files in this directory are applied **after** `supabase/seed.sql` by
`scripts/db-apply.sh`. They run in alphabetical order, so name them like
`YYYY-supafest.sql`.

## Adding next year's event

1. Copy `2027-supafest.sql` to `YYYY-supafest.sql`.
2. Update the variables in the `do $$ ... $$` block at the top: event id,
   name, dates, location, time zone, deadlines.
3. Edit the documents and sessions to match the new programme.
4. Run `npm run db:apply` to wipe and re-apply.

The script is idempotent — re-running it on a populated database is a
no-op for the event row itself, but session and document seeding skips
when the event already exists.

## Why a separate file (and not just `seed.sql`)?

`seed.sql` is the canonical "people" fixture: a few employees, an admin,
one guest. Those identities don't change year over year. Event-specific
data does. Keeping them apart means a year-end reset is "drop the old
events file, drop the new one in" without touching identity rows.
