import { BOARD_SIZE, type Move } from "../types/game";

export function createBoard(moves: Move[]) {
  const board: (string | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );

  for (const move of moves) {
    board[move.y][move.x] = move.player_id;
  }

  return board;
}

export function hasFive(
  board: (string | null)[][],
  x: number,
  y: number,
  playerId: string,
) {
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (const [dx, dy] of dirs) {
    let count = 1;

    let nx = x + dx;
    let ny = y + dy;
    while (
      nx >= 0 &&
      nx < BOARD_SIZE &&
      ny >= 0 &&
      ny < BOARD_SIZE &&
      board[ny][nx] === playerId
    ) {
      count += 1;
      nx += dx;
      ny += dy;
    }

    nx = x - dx;
    ny = y - dy;
    while (
      nx >= 0 &&
      nx < BOARD_SIZE &&
      ny >= 0 &&
      ny < BOARD_SIZE &&
      board[ny][nx] === playerId
    ) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

export function shortId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
