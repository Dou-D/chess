import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBoard, hasFive } from "../lib/gomoku";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  BOARD_SIZE,
  type Game,
  type Invite,
  type Move,
  type RematchVote,
} from "../types/game";

type RealtimeState = {
  incomingInvites: boolean;
  outgoingInvites: boolean;
  games: boolean;
  moves: boolean;
  rematch: boolean;
};

const DEFAULT_REALTIME_STATE: RealtimeState = {
  incomingInvites: false,
  outgoingInvites: false,
  games: false,
  moves: false,
  rematch: false,
};

function getMsLeft(expiresAt: string) {
  const expires = new Date(expiresAt).getTime();
  return expires - Date.now();
}

export function useGomokuGame() {
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rematchAvailable, setRematchAvailable] = useState(true);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(
    DEFAULT_REALTIME_STATE,
  );
  const [rematchCountdown, setRematchCountdown] = useState(0);

  const timeoutHandledForGame = useRef<string | null>(null);

  const invitesRealtimeHealthy =
    realtimeEnabled &&
    realtimeState.incomingInvites &&
    realtimeState.outgoingInvites;
  const gameRealtimeHealthy =
    realtimeEnabled &&
    realtimeState.games &&
    realtimeState.moves &&
    realtimeState.rematch;

  const lobbyRealtimeHealthy =
    realtimeEnabled &&
    realtimeState.incomingInvites &&
    realtimeState.outgoingInvites &&
    realtimeState.games;

  const handleRematchMissing = useCallback(() => {
    setRematchAvailable(false);
    setErrorMessage(
      "再来一局功能未启用：请到 Supabase 执行最新 supabase/schema.sql（缺少 rematch_votes 表）。",
    );
  }, []);

  const disconnectRealtime = useCallback((message?: string) => {
    setRealtimeEnabled(false);
    setRealtimeState(DEFAULT_REALTIME_STATE);
    if (message) {
      setNotice(message);
      setTimeout(() => setNotice(null), 1800);
    }
  }, []);

  const reconnectRealtime = useCallback(() => {
    if (realtimeEnabled) {
      return;
    }

    setRealtimeEnabled(true);
    setErrorMessage(null);
    setNotice("已重新连接实时同步");
    setTimeout(() => setNotice(null), 1200);

    if (userId) {
      void queryClient.invalidateQueries({
        queryKey: ["incomingInvites", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["outgoingInvites", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      void queryClient.invalidateQueries({ queryKey: ["moves"] });
      void queryClient.invalidateQueries({ queryKey: ["rematchVote"] });
    }
  }, [queryClient, realtimeEnabled, userId]);

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      setErrorMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          if (error.code === "anonymous_provider_disabled") {
            setErrorMessage(
              "匿名登录未开启：请到 Supabase 控制台 Authentication -> Providers -> Anonymous 启用后重试。",
            );
          } else {
            setErrorMessage(`匿名登录失败: ${error.message}`);
          }
          setAuthLoading(false);
          return;
        }
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        setErrorMessage(`读取用户失败: ${userError?.message ?? "未知错误"}`);
        setAuthLoading(false);
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);
      await supabase.from("profiles").upsert({ id: uid });
      setAuthLoading(false);
    };

    void init();
  }, []);

  const incomingInvitesQuery = useQuery({
    queryKey: ["incomingInvites", userId],
    enabled: Boolean(userId && supabase),
    refetchInterval: realtimeEnabled
      ? invitesRealtimeHealthy
        ? false
        : 1200
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("invites")
        .select("*")
        .eq("to_user", userId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as Invite[]) ?? [];
    },
  });

  const outgoingInvitesQuery = useQuery({
    queryKey: ["outgoingInvites", userId],
    enabled: Boolean(userId && supabase),
    refetchInterval: realtimeEnabled
      ? invitesRealtimeHealthy
        ? false
        : 1200
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("invites")
        .select("*")
        .eq("from_user", userId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as Invite[]) ?? [];
    },
  });

  const activeGameQuery = useQuery({
    queryKey: ["activeGame", userId],
    enabled: Boolean(userId && supabase),
    refetchInterval: realtimeEnabled
      ? gameRealtimeHealthy
        ? false
        : 900
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("games")
        .select("*")
        .or(`black_player.eq.${userId!},white_player.eq.${userId!}`)
        .in("status", ["waiting", "playing", "finished"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return (
        data && data.length > 0 ? (data[0] as Game) : null
      ) as Game | null;
    },
  });

  const activeGame = activeGameQuery.data ?? null;

  const syncMode: "websocket" | "fallback" | "disconnected" = !realtimeEnabled
    ? "disconnected"
    : activeGame?.id
      ? gameRealtimeHealthy
        ? "websocket"
        : "fallback"
      : lobbyRealtimeHealthy
        ? "websocket"
        : "fallback";

  const movesQuery = useQuery({
    queryKey: ["moves", activeGame?.id],
    enabled: Boolean(activeGame?.id && supabase),
    refetchInterval: realtimeEnabled
      ? realtimeState.moves
        ? false
        : 700
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("moves")
        .select("*")
        .eq("game_id", activeGame!.id)
        .order("move_index", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data as Move[]) ?? [];
    },
  });

  const rematchVoteQuery = useQuery({
    queryKey: ["rematchVote", activeGame?.id],
    enabled: Boolean(
      activeGame?.id &&
      activeGame.status === "finished" &&
      supabase &&
      rematchAvailable,
    ),
    refetchInterval: realtimeEnabled
      ? realtimeState.rematch
        ? false
        : 900
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("rematch_votes")
        .select("*")
        .eq("game_id", activeGame!.id)
        .maybeSingle();

      if (error) {
        if (error.message.includes("public.rematch_votes")) {
          handleRematchMissing();
          return null;
        }
        throw new Error(error.message);
      }

      return (data as RematchVote | null) ?? null;
    },
  });

  const incomingInvites = incomingInvitesQuery.data ?? [];
  const outgoingInvites = outgoingInvitesQuery.data ?? [];
  const moves = movesQuery.data ?? [];
  const rematchVote = rematchVoteQuery.data ?? null;

  useEffect(() => {
    if (
      !supabase ||
      !activeGame ||
      activeGame.status !== "finished" ||
      rematchVote ||
      !realtimeEnabled ||
      !rematchAvailable
    ) {
      return;
    }

    const client = supabase;

    const ensureRematchVote = async () => {
      const { error } = await client
        .from("rematch_votes")
        .insert({
          game_id: activeGame.id,
          status: "pending",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .select("game_id")
        .single();

      if (error && error.message.includes("public.rematch_votes")) {
        handleRematchMissing();
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ["rematchVote", activeGame.id],
      });
    };

    void ensureRematchVote();
  }, [
    activeGame?.id,
    activeGame?.status,
    handleRematchMissing,
    rematchVote,
    rematchAvailable,
    realtimeEnabled,
    queryClient,
  ]);

  const loading =
    authLoading ||
    incomingInvitesQuery.isLoading ||
    outgoingInvitesQuery.isLoading ||
    activeGameQuery.isLoading;

  useEffect(() => {
    const firstError =
      incomingInvitesQuery.error ??
      outgoingInvitesQuery.error ??
      activeGameQuery.error ??
      movesQuery.error ??
      (rematchAvailable ? rematchVoteQuery.error : null);

    if (!firstError) {
      return;
    }

    setErrorMessage(`实时同步异常: ${(firstError as Error).message}`);
  }, [
    incomingInvitesQuery.error,
    outgoingInvitesQuery.error,
    activeGameQuery.error,
    movesQuery.error,
    rematchVoteQuery.error,
  ]);

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

  const isBlack = Boolean(
    activeGame && userId && activeGame.black_player === userId,
  );
  const myRematchReady = activeGame
    ? isBlack
      ? (rematchVote?.black_ready ?? false)
      : (rematchVote?.white_ready ?? false)
    : false;
  const opponentRematchReady = activeGame
    ? isBlack
      ? (rematchVote?.white_ready ?? false)
      : (rematchVote?.black_ready ?? false)
    : false;

  useEffect(() => {
    if (!activeGame || activeGame.status !== "finished") {
      setRematchCountdown(0);
      timeoutHandledForGame.current = null;
      return;
    }

    if (!rematchVote || rematchVote.status !== "pending") {
      setRematchCountdown(0);
      return;
    }

    const gameId = activeGame.id;
    const tick = () => {
      const msLeft = getMsLeft(rematchVote.expires_at);
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      setRematchCountdown(secLeft);

      if (msLeft > 0 || timeoutHandledForGame.current === gameId || !supabase) {
        return;
      }

      timeoutHandledForGame.current = gameId;
      void supabase
        .from("rematch_votes")
        .update({ status: "timeout" })
        .eq("game_id", gameId)
        .eq("status", "pending");

      disconnectRealtime("超时未确认再来一局，实时连接已关闭。");
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeGame?.id,
    activeGame?.status,
    rematchVote?.status,
    rematchVote?.expires_at,
  ]);

  useEffect(() => {
    if (!activeGame || activeGame.status !== "finished" || !rematchVote) {
      return;
    }

    if (rematchVote.status === "declined") {
      disconnectRealtime("有玩家拒绝再来一局，实时连接已关闭。");
      return;
    }

    if (rematchVote.status === "timeout") {
      disconnectRealtime("再来一局超时，实时连接已关闭。");
      return;
    }

    if (rematchVote.status === "accepted" && rematchVote.next_game_id) {
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["moves", rematchVote.next_game_id],
      });
      setNotice("双方确认完成，已开始下一局");
      setTimeout(() => setNotice(null), 1200);
      timeoutHandledForGame.current = null;
    }
  }, [
    activeGame?.id,
    activeGame?.status,
    rematchVote?.status,
    rematchVote?.next_game_id,
    queryClient,
    userId,
  ]);

  useEffect(() => {
    if (!supabase || !userId || !realtimeEnabled) {
      return;
    }

    const client = supabase;
    const channels: RealtimeChannel[] = [];

    const markRealtime = (key: keyof RealtimeState, connected: boolean) => {
      setRealtimeState((prev) => {
        if (prev[key] === connected) {
          return prev;
        }
        return { ...prev, [key]: connected };
      });
    };

    const invalidateBase = () => {
      void queryClient.invalidateQueries({
        queryKey: ["incomingInvites", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["outgoingInvites", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
    };

    const incomingInvitesChannel = client
      .channel(`invites:incoming:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invites",
          filter: `to_user=eq.${userId}`,
        },
        invalidateBase,
      )
      .subscribe((status) => {
        markRealtime("incomingInvites", status === "SUBSCRIBED");
      });
    channels.push(incomingInvitesChannel);

    const outgoingInvitesChannel = client
      .channel(`invites:outgoing:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invites",
          filter: `from_user=eq.${userId}`,
        },
        invalidateBase,
      )
      .subscribe((status) => {
        markRealtime("outgoingInvites", status === "SUBSCRIBED");
      });
    channels.push(outgoingInvitesChannel);

    const gamesChannel = client
      .channel(`games:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => {
          invalidateBase();
          if (activeGame?.id) {
            void queryClient.invalidateQueries({
              queryKey: ["moves", activeGame.id],
            });
            void queryClient.invalidateQueries({
              queryKey: ["rematchVote", activeGame.id],
            });
          }
        },
      )
      .subscribe((status) => {
        markRealtime("games", status === "SUBSCRIBED");
      });
    channels.push(gamesChannel);

    if (activeGame?.id) {
      const currentGameId = activeGame.id;
      const movesChannel = client
        .channel(`moves:${userId}:${currentGameId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "moves",
            filter: `game_id=eq.${currentGameId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const nextMove = payload.new as Move;
              queryClient.setQueryData<Move[]>(
                ["moves", currentGameId],
                (prev) => {
                  const current = prev ?? [];
                  if (current.some((item) => item.id === nextMove.id)) {
                    return current;
                  }
                  return [...current, nextMove].sort(
                    (a, b) => a.move_index - b.move_index,
                  );
                },
              );
            } else {
              void queryClient.invalidateQueries({
                queryKey: ["moves", currentGameId],
              });
            }

            void queryClient.invalidateQueries({
              queryKey: ["activeGame", userId],
            });
          },
        )
        .subscribe((status) => {
          markRealtime("moves", status === "SUBSCRIBED");
        });
      channels.push(movesChannel);

      if (rematchAvailable) {
        const rematchChannel = client
          .channel(`rematch:${userId}:${currentGameId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "rematch_votes",
              filter: `game_id=eq.${currentGameId}`,
            },
            () => {
              void queryClient.invalidateQueries({
                queryKey: ["rematchVote", currentGameId],
              });
              void queryClient.invalidateQueries({
                queryKey: ["activeGame", userId],
              });
            },
          )
          .subscribe((status) => {
            markRealtime("rematch", status === "SUBSCRIBED");
          });
        channels.push(rematchChannel);
      } else {
        markRealtime("rematch", false);
      }
    } else {
      markRealtime("moves", false);
      markRealtime("rematch", false);
    }

    return () => {
      for (const channel of channels) {
        void client.removeChannel(channel);
      }
      setRealtimeState(DEFAULT_REALTIME_STATE);
    };
  }, [userId, activeGame?.id, queryClient, realtimeEnabled]);

  const copyUserId = useCallback(async () => {
    if (!userId) {
      return;
    }

    const fallbackCopy = (text: string) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(userId);
      } else {
        const copied = fallbackCopy(userId);
        if (!copied) {
          throw new Error("fallback copy failed");
        }
      }

      setNotice("已复制你的用户 ID");
      setErrorMessage(null);
      setTimeout(() => setNotice(null), 1200);
    } catch {
      const copied = fallbackCopy(userId);
      if (copied) {
        setNotice("已复制你的用户 ID");
        setErrorMessage(null);
        setTimeout(() => setNotice(null), 1200);
        return;
      }

      setErrorMessage(
        "复制失败：请检查浏览器剪贴板权限，或手动选择上方 ID 进行复制。",
      );
    }
  }, [userId]);

  const sendInvite = useCallback(
    async (toUserInput: string) => {
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
      void queryClient.invalidateQueries({
        queryKey: ["outgoingInvites", userId],
      });
    },
    [queryClient, userId],
  );

  const respondInvite = useCallback(
    async (invite: Invite, accepted: boolean) => {
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

        void queryClient.invalidateQueries({
          queryKey: ["incomingInvites", userId],
        });
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

      void queryClient.invalidateQueries({
        queryKey: ["incomingInvites", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["outgoingInvites", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      void queryClient.invalidateQueries({ queryKey: ["moves", gameData.id] });
    },
    [queryClient, userId],
  );

  const tryStartRematch = useCallback(async (vote: RematchVote, game: Game) => {
    if (!supabase || !userId) {
      return;
    }

    if (!(vote.black_ready && vote.white_ready) || vote.status !== "pending") {
      return;
    }

    const { data: lockRows, error: lockError } = await supabase
      .from("rematch_votes")
      .update({ status: "starting" })
      .eq("game_id", game.id)
      .eq("status", "pending")
      .eq("black_ready", true)
      .eq("white_ready", true)
      .is("next_game_id", null)
      .select("*");

    if (lockError || !lockRows || lockRows.length === 0) {
      if (lockError?.message?.includes("public.rematch_votes")) {
        handleRematchMissing();
      }
      return;
    }

    const { data: newGame, error: newGameError } = await supabase
      .from("games")
      .insert({
        black_player: game.black_player,
        white_player: game.white_player,
        status: "playing",
        current_turn: game.black_player,
      })
      .select("*")
      .single();

    if (newGameError || !newGame) {
      await supabase
        .from("rematch_votes")
        .update({ status: "pending" })
        .eq("game_id", game.id)
        .eq("status", "starting");
      return;
    }

    await supabase
      .from("rematch_votes")
      .update({ status: "accepted", next_game_id: newGame.id })
      .eq("game_id", game.id);

    void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
    void queryClient.invalidateQueries({ queryKey: ["moves", newGame.id] });
    void queryClient.invalidateQueries({ queryKey: ["rematchVote", game.id] });
  }, [handleRematchMissing, queryClient, userId]);

  const chooseRematch = useCallback(
    async (accept: boolean) => {
      if (
        !supabase ||
        !activeGame ||
        !userId ||
        activeGame.status !== "finished"
      ) {
        return;
      }

      if (!rematchAvailable) {
        handleRematchMissing();
        return;
      }

      setBusy(true);
      setErrorMessage(null);

      const blackReady = activeGame.black_player === userId;
      const whiteReady = activeGame.white_player === userId;

      if (!accept) {
        const payload = {
          game_id: activeGame.id,
          black_ready: false,
          white_ready: false,
          status: "declined",
        };

        const { error } = rematchVote
          ? await supabase
              .from("rematch_votes")
              .update(payload)
              .eq("game_id", activeGame.id)
          : await supabase.from("rematch_votes").insert(payload);

        setBusy(false);
        if (error) {
          if (error.message.includes("public.rematch_votes")) {
            handleRematchMissing();
            return;
          }
          setErrorMessage(`提交再来一局选择失败: ${error.message}`);
          return;
        }

        void queryClient.invalidateQueries({
          queryKey: ["rematchVote", activeGame.id],
        });
        disconnectRealtime("你已结束本局，实时连接已关闭。");
        return;
      }

      let nextVote: RematchVote | null = rematchVote;
      if (!nextVote) {
        const { data, error } = await supabase
          .from("rematch_votes")
          .insert({
            game_id: activeGame.id,
            black_ready: blackReady,
            white_ready: whiteReady,
            status: "pending",
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          })
          .select("*")
          .single();

        if (error || !data) {
          setBusy(false);
          if (error?.message?.includes("public.rematch_votes")) {
            handleRematchMissing();
            return;
          }
          setErrorMessage(`提交再来一局失败: ${error?.message ?? "未知错误"}`);
          return;
        }

        nextVote = data as RematchVote;
      } else {
        if (nextVote.status === "declined" || nextVote.status === "timeout") {
          setBusy(false);
          setErrorMessage("本局再来一局已结束，无法再次确认。");
          return;
        }

        const { data, error } = await supabase
          .from("rematch_votes")
          .update({
            black_ready: blackReady ? true : nextVote.black_ready,
            white_ready: whiteReady ? true : nextVote.white_ready,
            status: "pending",
          })
          .eq("game_id", activeGame.id)
          .select("*")
          .single();

        if (error || !data) {
          setBusy(false);
          if (error?.message?.includes("public.rematch_votes")) {
            handleRematchMissing();
            return;
          }
          setErrorMessage(`更新再来一局失败: ${error?.message ?? "未知错误"}`);
          return;
        }

        nextVote = data as RematchVote;
      }

      await tryStartRematch(nextVote, activeGame);
      void queryClient.invalidateQueries({
        queryKey: ["rematchVote", activeGame.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      setBusy(false);
    },
    [
      activeGame,
      handleRematchMissing,
      queryClient,
      rematchAvailable,
      rematchVote,
      tryStartRematch,
      userId,
    ],
  );

  const placeStone = useCallback(
    async (x: number, y: number) => {
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

      queryClient.setQueryData<Move[]>(["moves", activeGame.id], nextMoves);
      queryClient.setQueryData<Game | null>(["activeGame", userId], {
        ...activeGame,
        ...updatePayload,
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
    },
    [activeGame, board, moves, queryClient, userId],
  );

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
    rematchCountdown,
    myRematchReady,
    opponentRematchReady,
    rematchAvailable,
    syncMode,
    copyUserId,
    reconnectRealtime,
    sendInvite,
    respondInvite,
    chooseRematch,
    placeStone,
    clearError: () => setErrorMessage(null),
  };
}
