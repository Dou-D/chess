# Gameplay and UX Rules

## Match Start

1. Both players set and save their own battle ID (`public_id`).
2. Player A inputs Player B battle ID and sends invite.
3. Player B accepts invite.
4. A new `games` row is created and both clients sync into the same board.

## Turn Rules

- 15x15 board
- Black moves first
- Only current turn player can place a stone
- Win condition: 5 in a row (horizontal/vertical/diagonal)
- Each turn has countdown; timeout triggers random legal move for current player

## Game Finish

- Result overlay appears with: `Victory`, `Defeat`, or `Draw`.
- Current game realtime connection is released after finish.
- Opponent battle ID is retained in invite input for convenience.
- New match requires manually sending a new invite.

## Session Behavior

- On fresh page load, app does not auto-attach to old finished/playing games from previous sessions.
- Only matches created/accepted in current session are auto-entered.
