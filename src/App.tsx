import { BoardCard } from "./components/game/board-card";
import { IdentityCard } from "./components/game/identity-card";
import { InviteCard } from "./components/game/invite-card";
import { Alert } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { useGomokuGame } from "./hooks/use-gomoku-game";

function App() {
  const {
    isSupabaseConfigured,
    board,
    userId,
    incomingInvites,
    outgoingInvites,
    activeGame,
    loading,
    busy,
    notice,
    errorMessage,
    myColor,
    opponentId,
    rematchCountdown,
    myRematchReady,
    opponentRematchReady,
    syncMode,
    copyUserId,
    reconnectRealtime,
    sendInvite,
    respondInvite,
    chooseRematch,
    placeStone,
  } = useGomokuGame();

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center p-4">
        <Card className="w-full border-rose-200">
          <CardHeader>
            <CardTitle>五子棋</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>缺少环境变量，请创建 `.env.local`：</p>
            <pre className="overflow-x-auto rounded-md bg-stone-900 p-3 text-stone-100">{`VITE_SUPABASE_URL=你的Supabase项目URL\nVITE_SUPABASE_ANON_KEY=你的匿名Key`}</pre>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(254,243,199,0.7),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(191,219,254,0.65),transparent_38%),linear-gradient(145deg,#fafaf9,#f5f5f4)] px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <header className="space-y-1 rounded-xl border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                Realtime Gomoku Arena
              </h1>
              <p className="text-sm text-stone-600 sm:text-base">
                输入对方 ID 发起邀请，对方同意后即时开局。
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                    ? "Fallback Polling"
                    : "Disconnected"}
              </Badge>

              {syncMode === "disconnected" ? (
                <Button size="sm" onClick={reconnectRealtime}>
                  重新连接
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <IdentityCard
            userId={userId}
            loading={loading}
            notice={notice}
            onCopy={copyUserId}
          />
          <div className="lg:col-span-2">
            <InviteCard
              loading={loading}
              busy={busy}
              outgoingInvites={outgoingInvites}
              incomingInvites={incomingInvites}
              onSendInvite={sendInvite}
              onRespondInvite={respondInvite}
            />
          </div>
        </section>

        <BoardCard
          board={board}
          activeGame={activeGame}
          userId={userId}
          myColor={myColor}
          opponentId={opponentId}
          busy={busy}
          rematchCountdown={rematchCountdown}
          myRematchReady={myRematchReady}
          opponentRematchReady={opponentRematchReady}
          onRematchChoice={chooseRematch}
          onPlaceStone={placeStone}
        />

        {errorMessage ? <Alert>{errorMessage}</Alert> : null}
      </div>
    </main>
  );
}

export default App;
