# pgTAP tests

Database tests run with `supabase test db`. Each `*.sql` file uses pgTAP and
asserts a single piece of behavior.

## Naming

```
<table-or-feature>__<expected-behavior>.sql
```

Examples:

```
registrations__own_row_visible_to_self.sql
registrations__other_users_blocked.sql
flights_arrival_at__cascades_to_transport_requests.sql
```

## Anatomy

```sql
begin;
select plan(2);

-- arrange
insert into ...;

-- act
set local role authenticated;
set local request.jwt.claims to '{"sub":"...","role":"employee"}';

-- assert
select results_eq('select id from registrations', $$values ('uuid-1')$$);
select is(count(*)::int, 1) from ...;

select * from finish();
rollback;
```

Wrap every test in a transaction. `rollback` keeps the suite hermetic.
