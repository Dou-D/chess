# Gameplay and UX Rules

## Match Start

1. Player A inputs Player B ID and sends invite.
2. Player B accepts invite.
3. A new `games` row is created and both clients sync into the same board.

## Turn Rules

- 15x15 board
- Black moves first
- Only current turn player can place a stone
- Win condition: 5 in a row (horizontal/vertical/diagonal)

## Game Finish

- GSAP overlay appears with result state: `Victory`, `Defeat`, or `Draw`.
- Both players can choose `再来一局`.
- A new game starts only when both ready flags are true.
- If one player declines, realtime is disconnected for this session.
- If both do not confirm within 60 seconds, status becomes timeout and realtime is disconnected.
