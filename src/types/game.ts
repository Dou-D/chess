export const BOARD_SIZE = 15;

export type InviteStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type GameStatus = "waiting" | "playing" | "finished";

export type Invite = {
  id: string;
  from_user: string;
  to_user: string;
  status: InviteStatus;
  game_id: string | null;
  created_at: string;
};

export type Game = {
  id: string;
  black_player: string;
  white_player: string;
  status: GameStatus;
  winner: string | null;
  current_turn: string;
  created_at: string;
};

export type Move = {
  id: number;
  game_id: string;
  player_id: string;
  x: number;
  y: number;
  move_index: number;
  created_at: string;
};
