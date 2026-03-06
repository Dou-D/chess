import { memo } from "react";
import type { Game } from "../../types/game";
import { shortId } from "../../lib/gomoku";
import { Badge } from "../ui/badge";
import { GomokuCanvas } from "./gomoku-canvas";
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
  isMyTurn: boolean;
  turnCountdown: number;
  syncMode: "websocket" | "fallback" | "disconnected";
  onPlaceStone: (x: number, y: number) => Promise<void>;
};

export const BoardCard = memo(function BoardCard({
  board,
  activeGame,
  userId,
  myColor,
  opponentId,
  busy,
  isMyTurn,
  turnCountdown,
  syncMode,
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              activeGame?.current_turn === userId ? "default" : "secondary"
            }
          >
            {statusText}
          </Badge>
          <Badge
            variant={
              syncMode === "websocket"
                ? "success"
                : syncMode === "fallback"
                  ? "secondary"
                  : "default"
            }
          >
            {syncMode === "websocket"
              ? "WebSocket"
              : syncMode === "fallback"
                ? "轮询降级"
                : "已断开"}
          </Badge>
          {isMyTurn ? (
            <Badge variant={turnCountdown <= 5 ? "secondary" : "default"}>
              你的回合: {turnCountdown}s
            </Badge>
          ) : null}
        </div>

        <div className="relative overflow-x-auto rounded-lg border border-stone-300 bg-stone-200 p-2">
          <GomokuCanvas
            board={board}
            blackPlayerId={activeGame?.black_player ?? null}
            disabled={busy || !activeGame || activeGame.status !== "playing"}
            onPlaceStone={(x, y) => {
              void onPlaceStone(x, y);
            }}
          />

          {activeGame?.status === "finished" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/55 p-3">
              <div className="rounded-xl bg-white/95 px-5 py-4 text-center shadow-lg">
                <p className="text-2xl font-bold text-stone-900">
                  {gameFinishTitle}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  本局结束，已释放上一局连接。可直接用上方已保存的对手 ID
                  再次邀请。
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
});
