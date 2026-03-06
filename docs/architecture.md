# Architecture

## Stack

- Frontend: React + TypeScript + Vite
- UI: TailwindCSS + shadcn-style primitives
- Data transport: Supabase Realtime (WebSocket first) + TanStack Query fallback polling
- Animation: GSAP for game-finish overlay

## Main Modules

- `src/hooks/use-gomoku-game.ts`
  - Auth initialization
  - Invite lifecycle
  - Move placement and win checking
  - Realtime subscriptions and fallback polling
  - Rematch agreement protocol
- `src/components/game/*`
  - Game-facing UI components
- `src/components/ui/*`
  - Reusable primitive UI components

## Sync Strategy

- Primary channel: Supabase Realtime `postgres_changes`
- Fallback channel: TanStack Query `refetchInterval`
- Polling is disabled when related realtime channels are healthy, and only enabled when realtime is unavailable.

## Rematch Protocol

- A finished game writes/updates one row in `rematch_votes`.
- New game starts only when both sides choose rematch.
- If any side declines or no full agreement within 60s, clients close realtime connection.
