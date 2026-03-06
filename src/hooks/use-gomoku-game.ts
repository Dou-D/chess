import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBoard, hasFive } from "../lib/gomoku";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { BOARD_SIZE, type Game, type Invite, type Move } from "../types/game";

export function useGomokuGame() {
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingInvites, setIncomingInvites] = useState<Invite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<Invite[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const board = useMemo(() => createBoard(moves), [moves]);

  const myColor = useMemo(() => {
    if (!activeGame || !userId) {
      return null;
    }

    if (activeGame.black_player === userId) {
      return "Black";
    }
    if (activeGame.white_player === userId) {
      return "White";
    }

    return null;
  }, [activeGame, userId]);

  const opponentId = useMemo(() => {
    if (!activeGame || !userId) {
      return null;
    }

    return activeGame.black_player === userId
      ? activeGame.white_player
      : activeGame.black_player;
  }, [activeGame, userId]);

  async function ensureProfile(uid: string) {
    if (!supabase) {
      return;
    }
    await supabase.from("profiles").upsert({ id: uid });
  }

  async function loadIncoming(uid: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .eq("to_user", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(`加载收到的邀请失败: ${error.message}`);
      return;
    }

    setIncomingInvites((data as Invite[]) ?? []);
  }

  async function loadOutgoing(uid: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .eq("from_user", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(`加载发出的邀请失败: ${error.message}`);
      return;
    }

    setOutgoingInvites((data as Invite[]) ?? []);
  }

  async function loadGame(gameId: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (error) {
      setErrorMessage(`加载对局失败: ${error.message}`);
      return;
    }

    setActiveGame(data as Game);
  }

  async function loadMoves(gameId: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("moves")
      .select("*")
      .eq("game_id", gameId)
      .order("move_index", { ascending: true });

    if (error) {
      setErrorMessage(`加载落子记录失败: ${error.message}`);
      return;
    }

    setMoves((data as Move[]) ?? []);
  }

  async function restoreActiveGame(uid: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .or(`black_player.eq.${uid},white_player.eq.${uid}`)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setErrorMessage(`恢复对局失败: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      const game = data[0] as Game;
      setActiveGame(game);
      await loadMoves(game.id);
    }
  }

  async function init() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setErrorMessage(`匿名登录失败: ${error.message}`);
        setLoading(false);
        return;
      }
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage(`读取用户失败: ${userError?.message ?? "未知错误"}`);
      setLoading(false);
      return;
    }

    const uid = userData.user.id;
    setUserId(uid);
    await ensureProfile(uid);
    await Promise.all([
      loadIncoming(uid),
      loadOutgoing(uid),
      restoreActiveGame(uid),
    ]);
    setLoading(false);
  }

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const client = supabase;

    const channels: RealtimeChannel[] = [];

    const invitesChannel = client
      .channel(`invites:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invites" },
        async () => {
          await Promise.all([loadIncoming(userId), loadOutgoing(userId)]);
        },
      )
      .subscribe();

    channels.push(invitesChannel);

    const gamesChannel = client
      .channel(`games:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        async (payload) => {
          const next = payload.new as Partial<Game>;
          if (!next?.id) {
            return;
          }

          const related =
            next.black_player === userId || next.white_player === userId;
          if (!related) {
            return;
          }

          if (!activeGame || activeGame.id === next.id) {
            await loadGame(next.id);
            await loadMoves(next.id);
          }
        },
      )
      .subscribe();

    channels.push(gamesChannel);

    const movesChannel = client
      .channel(`moves:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moves" },
        async (payload) => {
          const nextMove = payload.new as Move;
          if (!activeGame || nextMove.game_id !== activeGame.id) {
            return;
          }

          setMoves((prev) => {
            if (prev.some((item) => item.id === nextMove.id)) {
              return prev;
            }
            return [...prev, nextMove].sort(
              (a, b) => a.move_index - b.move_index,
            );
          });
        },
      )
      .subscribe();

    channels.push(movesChannel);

    return () => {
      for (const channel of channels) {
        void client.removeChannel(channel);
      }
    };
  }, [userId, activeGame?.id]);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const client = supabase;

    const joinAcceptedGame = async () => {
      const { data, error } = await client
        .from("invites")
        .select("*")
        .eq("from_user", userId)
        .eq("status", "accepted")
        .not("game_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return;
      }

      const invite = data[0] as Invite;
      if (invite.game_id) {
        await loadGame(invite.game_id);
        await loadMoves(invite.game_id);
      }
    };

    void joinAcceptedGame();
  }, [outgoingInvites.length, userId]);

  async function copyUserId() {
    if (!userId) {
      return;
    }

    await navigator.clipboard.writeText(userId);
    setNotice("已复制你的用户 ID");
    setTimeout(() => setNotice(null), 1200);
  }

  async function sendInvite(toUserInput: string) {
    if (!supabase || !userId) {
      return;
    }

    const toUser = toUserInput.trim();
    if (!toUser) {
      setErrorMessage("请输入对方 ID");
      return;
    }

    if (toUser === userId) {
      setErrorMessage("不能邀请自己");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    const { error } = await supabase.from("invites").insert({
      from_user: userId,
      to_user: toUser,
      status: "pending",
    });

    setBusy(false);
    if (error) {
      setErrorMessage(`发送邀请失败: ${error.message}`);
      return;
    }

    setNotice("邀请已发送");
    setTimeout(() => setNotice(null), 1200);
    await loadOutgoing(userId);
  }

  async function respondInvite(invite: Invite, accepted: boolean) {
    if (!supabase || !userId) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    if (!accepted) {
      const { error } = await supabase
        .from("invites")
        .update({ status: "rejected" })
        .eq("id", invite.id);

      setBusy(false);
      if (error) {
        setErrorMessage(`拒绝邀请失败: ${error.message}`);
        return;
      }

      await loadIncoming(userId);
      return;
    }

    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .insert({
        black_player: invite.from_user,
        white_player: invite.to_user,
        status: "playing",
        current_turn: invite.from_user,
      })
      .select("*")
      .single();

    if (gameError || !gameData) {
      setBusy(false);
      setErrorMessage(`创建对局失败: ${gameError?.message ?? "未知错误"}`);
      return;
    }

    const { error: inviteError } = await supabase
      .from("invites")
      .update({ status: "accepted", game_id: gameData.id })
      .eq("id", invite.id);

    setBusy(false);
    if (inviteError) {
      setErrorMessage(`更新邀请状态失败: ${inviteError.message}`);
      return;
    }

    setActiveGame(gameData as Game);
    setMoves([]);
    await loadIncoming(userId);
    await loadOutgoing(userId);
  }

  async function placeStone(x: number, y: number) {
    if (!supabase || !activeGame || !userId) {
      return;
    }

    if (activeGame.status !== "playing") {
      return;
    }

    if (activeGame.current_turn !== userId) {
      setErrorMessage("还没轮到你落子");
      return;
    }

    if (board[y][x]) {
      setErrorMessage("该位置已有棋子");
      return;
    }

    setErrorMessage(null);
    const moveIndex = moves.length;

    const { data: inserted, error: moveError } = await supabase
      .from("moves")
      .insert({
        game_id: activeGame.id,
        player_id: userId,
        x,
        y,
        move_index: moveIndex,
      })
      .select("*")
      .single();

    if (moveError || !inserted) {
      setErrorMessage(`落子失败: ${moveError?.message ?? "未知错误"}`);
      return;
    }

    const nextMoves = [...moves, inserted as Move].sort(
      (a, b) => a.move_index - b.move_index,
    );

    setMoves(nextMoves);

    const nextBoard = createBoard(nextMoves);
    const winner = hasFive(nextBoard, x, y, userId) ? userId : null;
    const draw = !winner && nextMoves.length === BOARD_SIZE * BOARD_SIZE;

    const nextTurn =
      activeGame.black_player === userId
        ? activeGame.white_player
        : activeGame.black_player;

    const updatePayload: Partial<Game> = winner
      ? { status: "finished", winner: userId, current_turn: userId }
      : draw
        ? { status: "finished", winner: null, current_turn: userId }
        : { current_turn: nextTurn };

    const { error: gameError } = await supabase
      .from("games")
      .update(updatePayload)
      .eq("id", activeGame.id);

    if (gameError) {
      setErrorMessage(`更新对局状态失败: ${gameError.message}`);
      return;
    }

    await loadGame(activeGame.id);
  }

  return {
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
    copyUserId,
    sendInvite,
    respondInvite,
    placeStone,
    clearError: () => setErrorMessage(null),
  };
}
