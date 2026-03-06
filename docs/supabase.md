# Supabase Setup and Migration

## Required Tables

- `profiles`
- `invites`
- `games`
- `moves`
- `rematch_votes`

## Apply Schema

Run `supabase/schema.sql` in Supabase SQL Editor.

## Existing Project Migration (if already deployed)

If your project already had the previous schema, execute the full `schema.sql` again or at least apply:

- `create table public.rematch_votes ...`
- RLS policies for `rematch_votes`
- `set_rematch_updated_at` trigger

## Realtime Publication

Ensure these tables are in publication `supabase_realtime`:

- `public.invites`
- `public.games`
- `public.moves`
- `public.rematch_votes`

SQL shortcut:

```sql
alter publication supabase_realtime add table public.invites;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.rematch_votes;
```
