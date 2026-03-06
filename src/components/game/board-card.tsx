import { BOARD_SIZE, type Game } from "../../types/game";
import { shortId } from "../../lib/gomoku";
import { Badge } from "../ui/badge";
import { GameFinishOverlay } from "./game-finish-overlay";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type BoardCardProps = {
  board: (string | null)[][];
  activeGame: Game | null;
  userId: string | null;
  myColor: string | null;
  opponentId: string | null;
  busy: boolean;
  rematchCountdown: number;
  myRematchReady: boolean;
  opponentRematchReady: boolean;
  onRematchChoice: (accept: boolean) => Promise<void>;
  onPlaceStone: (x: number, y: number) => Promise<void>;
};

export function BoardCard({
  board,
  activeGame,
  userId,
  myColor,
  opponentId,
  busy,
  rematchCountdown,
  myRematchReady,
  opponentRematchReady,
  onRematchChoice,
  onPlaceStone,
}: BoardCardProps) {
  const statusText = !activeGame
    ? "暂无进行中的对局"
    : activeGame.status === "finished"
      ? activeGame.winner
        ? activeGame.winner === userId
          ? "你获胜了"
          : "对手获胜"
        : "平局"
      : activeGame.current_turn === userId
        ? "轮到你落子"
        : "等待对方落子";

  const gameFinishTitle =
    activeGame?.status !== "finished"
      ? ""
      : activeGame.winner
        ? activeGame.winner === userId
          ? "Victory"
          : "Defeat"
        : "Draw";

  return (
    <Card>
      <CardHeader>
        <CardTitle>当前对局</CardTitle>
        <CardDescription>
          {activeGame
            ? `你执 ${myColor} | 对手 ${opponentId ? shortId(opponentId) : "-"}`
            : "邀请成功后会自动进入对局"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge
          variant={
            activeGame?.current_turn === userId ? "default" : "secondary"
          }
        >
          {statusText}
        </Badge>

        <div className="relative overflow-x-auto rounded-lg border border-stone-300 bg-stone-200 p-2">
          <div
            className="mx-auto grid min-w-[320px] max-w-[680px] gap-[2px] rounded-md border border-amber-900 bg-amber-900 p-1"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            }}
            role="grid"
            aria-label="Gomoku Board"
          >
            {Array.from({ length: BOARD_SIZE }).map((_, y) =>
              Array.from({ length: BOARD_SIZE }).map((__, x) => {
                const cellPlayer = board[y][x];
                const stoneClass =
                  cellPlayer == null
                    ? ""
                    : activeGame && cellPlayer === activeGame.black_player
                      ? "bg-stone-900"
                      : "bg-stone-100 ring-1 ring-stone-300";

                return (
                  <button
                    key={`${x}-${y}`}
                    className="flex aspect-square items-center justify-center bg-amber-300 hover:bg-amber-200 disabled:cursor-not-allowed disabled:hover:bg-amber-300"
                    onClick={() => onPlaceStone(x, y)}
                    disabled={!activeGame || activeGame.status !== "playing"}
                    title={`${x},${y}`}
                  >
                    {stoneClass ? (
                      <span
                        className={`h-[78%] w-[78%] rounded-full ${stoneClass}`}
                      />
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>

          <GameFinishOverlay
            visible={activeGame?.status === "finished"}
            title={gameFinishTitle}
            countdown={rematchCountdown}
            myReady={myRematchReady}
            opponentReady={opponentRematchReady}
            busy={busy}
            onRematch={() => onRematchChoice(true)}
            onExit={() => onRematchChoice(false)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
