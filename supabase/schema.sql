-- Enable UUID generation helper.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  black_player uuid not null references public.profiles(id) on delete cascade,
  white_player uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'playing' check (status in ('waiting', 'playing', 'finished')),
  winner uuid references public.profiles(id) on delete set null,
  current_turn uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint game_players_diff check (black_player <> white_player),
  constraint game_turn_is_player check (current_turn = black_player or current_turn = white_player)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_users_diff check (from_user <> to_user)
);

create table if not exists public.moves (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  x int not null check (x between 0 and 14),
  y int not null check (y between 0 and 14),
  move_index int not null check (move_index >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, x, y),
  unique (game_id, move_index)
);

create index if not exists idx_invites_to_user_status on public.invites(to_user, status);
create index if not exists idx_invites_from_user_status on public.invites(from_user, status);
create index if not exists idx_games_black_player on public.games(black_player);
create index if not exists idx_games_white_player on public.games(white_player);
create index if not exists idx_moves_game_id on public.moves(game_id);

-- Keep profiles in sync for new auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.games enable row level security;
alter table public.moves enable row level security;

-- profiles policies
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- invites policies
drop policy if exists "invites_select_participants" on public.invites;
create policy "invites_select_participants"
on public.invites for select
using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "invites_insert_sender" on public.invites;
create policy "invites_insert_sender"
on public.invites for insert
with check (auth.uid() = from_user and from_user <> to_user);

drop policy if exists "invites_update_participants" on public.invites;
create policy "invites_update_participants"
on public.invites for update
using (auth.uid() = from_user or auth.uid() = to_user)
with check (auth.uid() = from_user or auth.uid() = to_user);

-- games policies
drop policy if exists "games_select_participants" on public.games;
create policy "games_select_participants"
on public.games for select
using (auth.uid() = black_player or auth.uid() = white_player);

drop policy if exists "games_insert_participants" on public.games;
create policy "games_insert_participants"
on public.games for insert
with check (
  (auth.uid() = black_player or auth.uid() = white_player)
  and black_player <> white_player
  and (current_turn = black_player or current_turn = white_player)
);

drop policy if exists "games_update_participants" on public.games;
create policy "games_update_participants"
on public.games for update
using (auth.uid() = black_player or auth.uid() = white_player)
with check (auth.uid() = black_player or auth.uid() = white_player);

-- moves policies
drop policy if exists "moves_select_game_participants" on public.moves;
create policy "moves_select_game_participants"
on public.moves for select
using (
  exists (
    select 1
    from public.games g
    where g.id = moves.game_id
      and (g.black_player = auth.uid() or g.white_player = auth.uid())
  )
);

drop policy if exists "moves_insert_current_turn" on public.moves;
create policy "moves_insert_current_turn"
on public.moves for insert
with check (
  x between 0 and 14
  and y between 0 and 14
  and player_id = auth.uid()
  and exists (
    select 1
    from public.games g
    where g.id = moves.game_id
      and g.status = 'playing'
      and g.current_turn = auth.uid()
      and (g.black_player = auth.uid() or g.white_player = auth.uid())
  )
);
