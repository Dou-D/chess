# Architecture

## Stack

- Frontend: React + TypeScript + Vite
- UI: TailwindCSS + shadcn-style primitives
- Data transport: Supabase Realtime (WebSocket first) + TanStack Query fallback polling
- Rendering: HTML Canvas board (with static-layer cache)

## Main Modules

- `src/hooks/use-gomoku-game.ts`
  - Auth initialization
  - Player public battle ID (`profiles.public_id`) setup/update
  - Invite lifecycle
  - Move placement and win checking
  - Turn timer and timeout auto-move
  - Realtime subscriptions and fallback polling
  - Session-scoped active game control (no auto-resume of old games)
- `src/components/game/*`
  - Game-facing UI components
- `src/components/game/gomoku-canvas.tsx`
  - Board draw pipeline
  - Static board cache + dynamic stone layer
- `src/components/ui/*`
  - Reusable primitive UI components

## Sync Strategy

- Primary channel: Supabase Realtime `postgres_changes`
- Fallback channel: TanStack Query `refetchInterval`
- Polling is disabled when related realtime channels are healthy, and only enabled when realtime is unavailable.

## Match Lifecycle

- A game starts after invite acceptance and game row creation.
- On finish, client shows result state (`Victory/Defeat/Draw`), releases realtime for that game, and clears active game for current session.
- Next match requires sending a new invite; previous game is not auto-resumed on page open.
