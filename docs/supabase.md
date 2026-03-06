# Supabase Setup and Migration

## Required Tables

- `profiles`
- `invites`
- `games`
- `moves`

Required column:

- `profiles.public_id` (unique, used for invite lookup)

## Apply Schema

Run `supabase/schema.sql` in Supabase SQL Editor.

## Existing Project Migration (if already deployed)

If your project already had previous schema, execute full `schema.sql` again or at least ensure:

- `alter table public.profiles add column public_id ...`
- unique index for `public_id`
- profiles select policy allows querying rows with non-null `public_id`

## Realtime Publication

Ensure these tables are in publication `supabase_realtime`:

- `public.invites`
- `public.games`
- `public.moves`

SQL shortcut:

```sql
alter publication supabase_realtime add table public.invites;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.moves;
```
