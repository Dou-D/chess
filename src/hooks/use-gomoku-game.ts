import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBoard, hasFive, shortId } from "../lib/gomoku";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { BOARD_SIZE, type Game, type Invite, type Move } from "../types/game";

type RealtimeState = {
  incomingInvites: boolean;
  outgoingInvites: boolean;
  games: boolean;
  moves: boolean;
};

type PlaceStoneOptions = {
  silent?: boolean;
};

const TURN_SECONDS = 15;
const PUBLIC_ID_RULE = /^[a-zA-Z0-9_-]{4,24}$/;

const DEFAULT_REALTIME_STATE: RealtimeState = {
  incomingInvites: false,
  outgoingInvites: false,
  games: false,
  moves: false,
};

function getOpponent(game: Game, userId: string) {
  return game.black_player === userId ? game.white_player : game.black_player;
}

export function useGomokuGame() {
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [myPublicId, setMyPublicId] = useState<string>("");
  const [publicIdDraft, setPublicIdDraft] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(
    DEFAULT_REALTIME_STATE,
  );
  const [targetInviteId, setTargetInviteId] = useState("");
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [finishedResultTitle, setFinishedResultTitle] = useState<string | null>(
    null,
  );
  const [turnCountdown, setTurnCountdown] = useState(0);

  const turnAnchorRef = useRef<string | null>(null);
  const turnDeadlineRef = useRef<number | null>(null);
  const autoMoveLockRef = useRef<string | null>(null);
  const prevActiveGameRef = useRef<Game | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const invitesRealtimeHealthy =
    realtimeEnabled &&
    realtimeState.incomingInvites &&
    realtimeState.outgoingInvites;

  const gameRealtimeHealthy =
    realtimeEnabled && realtimeState.games && realtimeState.moves;

  const lobbyRealtimeHealthy =
    realtimeEnabled &&
    realtimeState.incomingInvites &&
    realtimeState.outgoingInvites &&
    realtimeState.games;

  const disconnectRealtime = useCallback((message?: string) => {
    setRealtimeEnabled(false);
    setRealtimeState(DEFAULT_REALTIME_STATE);
    if (!message) {
      return;
    }

    setNotice(message);
    setTimeout(() => setNotice(null), 1800);
  }, []);

  const reconnectRealtime = useCallback(() => {
    if (realtimeEnabled) {
      return;
    }

    setRealtimeEnabled(true);
    setErrorMessage(null);
    setNotice("已重新连接实时同步");
    setTimeout(() => setNotice(null), 1200);

    if (!userId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: ["incomingInvites", userId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["outgoingInvites", userId],
    });
    void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
    void queryClient.invalidateQueries({ queryKey: ["moves"] });
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

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: uid })
        .select("public_id")
        .single();

      if (profileError) {
        if (profileError.message.includes("public_id")) {
          setErrorMessage(
            "缺少 profiles.public_id 字段，请执行最新 supabase/schema.sql 后刷新页面。",
          );
        } else {
          setErrorMessage(`初始化用户信息失败: ${profileError.message}`);
        }
      } else if (profileRow?.public_id) {
        setMyPublicId(profileRow.public_id);
        setPublicIdDraft(profileRow.public_id);
      }

      setAuthLoading(false);
    };

    void init();
  }, []);

  const savePublicId = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    const next = publicIdDraft.trim();
    if (!PUBLIC_ID_RULE.test(next)) {
      setErrorMessage("ID 需为 4-24 位，仅允许字母、数字、下划线、短横线。");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ public_id: next })
      .eq("id", userId);

    setBusy(false);
    if (error) {
      if (error.message.includes("public_id")) {
        setErrorMessage(
          "缺少 profiles.public_id 字段，请执行最新 supabase/schema.sql。",
        );
      } else if (error.message.toLowerCase().includes("duplicate")) {
        setErrorMessage("该 ID 已被占用，请更换后重试。");
      } else {
        setErrorMessage(`保存 ID 失败: ${error.message}`);
      }
      return;
    }

    setMyPublicId(next);
    setNotice("已保存你的对战 ID");
    setTimeout(() => setNotice(null), 1200);
  }, [publicIdDraft, userId]);

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
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as Invite[]) ?? [];
    },
  });

  const activeGameQuery = useQuery({
    queryKey: ["activeGame", userId, currentGameId],
    enabled: Boolean(userId && supabase && currentGameId),
    refetchInterval: realtimeEnabled
      ? gameRealtimeHealthy
        ? false
        : 900
      : false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("games")
        .select("*")
        .eq("id", currentGameId!)
        .or(`black_player.eq.${userId!},white_player.eq.${userId!}`)
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return data && data.length > 0 ? (data[0] as Game) : null;
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

  const incomingInvites = incomingInvitesQuery.data ?? [];
  const outgoingInvites = outgoingInvitesQuery.data ?? [];
  const moves = movesQuery.data ?? [];

  const relatedIds = useMemo(() => {
    const set = new Set<string>();
    if (userId) {
      set.add(userId);
    }
    for (const invite of incomingInvites) {
      set.add(invite.from_user);
      set.add(invite.to_user);
    }
    for (const invite of outgoingInvites) {
      set.add(invite.from_user);
      set.add(invite.to_user);
    }
    if (activeGame) {
      set.add(activeGame.black_player);
      set.add(activeGame.white_player);
    }
    return [...set];
  }, [activeGame, incomingInvites, outgoingInvites, userId]);

  const profileMapQuery = useQuery({
    queryKey: ["profileMap", relatedIds.join("|")],
    enabled: Boolean(supabase && relatedIds.length > 0),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("id, public_id")
        .in("id", relatedIds);

      if (error) {
        if (error.message.includes("public_id")) {
          return [] as Array<{ id: string; public_id: string | null }>;
        }
        throw new Error(error.message);
      }

      return (data as Array<{ id: string; public_id: string | null }>) ?? [];
    },
  });

  const publicIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of profileMapQuery.data ?? []) {
      if (row.public_id) {
        map.set(row.id, row.public_id);
      }
    }
    return map;
  }, [profileMapQuery.data]);

  const formatUserDisplay = useCallback(
    (id: string | null) => {
      if (!id) {
        return "-";
      }
      return publicIdMap.get(id) ?? shortId(id);
    },
    [publicIdMap],
  );

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
      profileMapQuery.error;

    if (!firstError) {
      return;
    }

    setErrorMessage(`实时同步异常: ${(firstError as Error).message}`);
  }, [
    incomingInvitesQuery.error,
    outgoingInvitesQuery.error,
    activeGameQuery.error,
    movesQuery.error,
    profileMapQuery.error,
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

    return getOpponent(activeGame, userId);
  }, [activeGame, userId]);

  const opponentDisplayId = useMemo(
    () => formatUserDisplay(opponentId),
    [formatUserDisplay, opponentId],
  );

  const isMyTurn = Boolean(
    activeGame &&
    activeGame.status === "playing" &&
    userId &&
    activeGame.current_turn === userId,
  );

  useEffect(() => {
    if (currentGameId || !userId) {
      return;
    }

    const acceptedInvite = outgoingInvites.find(
      (item) =>
        item.status === "accepted" &&
        item.game_id &&
        new Date(item.created_at).getTime() >= sessionStartRef.current,
    );
    if (!acceptedInvite?.game_id) {
      return;
    }

    setCurrentGameId(acceptedInvite.game_id);
    setFinishedResultTitle(null);
    setNotice("邀请已被接受，对局已开始");
    setTimeout(() => setNotice(null), 1200);
  }, [currentGameId, outgoingInvites, userId]);

  useEffect(() => {
    if (!activeGame || activeGame.status !== "finished" || !userId) {
      return;
    }

    const title = activeGame.winner
      ? activeGame.winner === userId
        ? "Victory"
        : "Defeat"
      : "Draw";

    setFinishedResultTitle(title);
    setTargetInviteId(opponentDisplayId === "-" ? "" : opponentDisplayId);
    setCurrentGameId(null);
    setNotice("本局已结束，已释放本局实时连接。若要继续请重新邀请。");
    setTimeout(() => setNotice(null), 1800);
  }, [activeGame, opponentDisplayId, userId]);

  useEffect(() => {
    const previous = prevActiveGameRef.current;
    if (previous && userId && (!activeGame || activeGame.id !== previous.id)) {
      const lastOpponent = getOpponent(previous, userId);
      const nextTarget = formatUserDisplay(lastOpponent);
      setTargetInviteId(nextTarget === "-" ? "" : nextTarget);
    }

    prevActiveGameRef.current = activeGame;
  }, [activeGame, formatUserDisplay, userId]);

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
    } else {
      markRealtime("moves", false);
    }

    return () => {
      for (const channel of channels) {
        void client.removeChannel(channel);
      }
      setRealtimeState(DEFAULT_REALTIME_STATE);
    };
  }, [userId, activeGame?.id, queryClient, realtimeEnabled]);

  const copyUserId = useCallback(async () => {
    if (!myPublicId) {
      setErrorMessage("请先设置并保存你的对战 ID");
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
        await navigator.clipboard.writeText(myPublicId);
      } else {
        const copied = fallbackCopy(myPublicId);
        if (!copied) {
          throw new Error("fallback copy failed");
        }
      }

      setNotice("已复制你的对战 ID");
      setErrorMessage(null);
      setTimeout(() => setNotice(null), 1200);
    } catch {
      const copied = fallbackCopy(myPublicId);
      if (copied) {
        setNotice("已复制你的对战 ID");
        setErrorMessage(null);
        setTimeout(() => setNotice(null), 1200);
        return;
      }

      setErrorMessage(
        "复制失败：请检查浏览器剪贴板权限，或手动选择上方 ID 进行复制。",
      );
    }
  }, [myPublicId]);

  const sendInvite = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    if (!myPublicId) {
      setErrorMessage("请先在左侧设置并保存你的对战 ID");
      return;
    }

    const toPublicId = targetInviteId.trim();
    if (!toPublicId) {
      setErrorMessage("请输入对方 ID");
      return;
    }

    if (toPublicId === myPublicId) {
      setErrorMessage("不能邀请自己");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("public_id", toPublicId)
      .maybeSingle();

    if (profileError) {
      setBusy(false);
      if (profileError.message.includes("public_id")) {
        setErrorMessage(
          "缺少 profiles.public_id 字段，请执行最新 supabase/schema.sql。",
        );
      } else {
        setErrorMessage(`查询对方 ID 失败: ${profileError.message}`);
      }
      return;
    }

    if (!targetProfile?.id) {
      setBusy(false);
      setErrorMessage("未找到该对战 ID，请确认对方已设置并保存。");
      return;
    }

    const { error } = await supabase.from("invites").insert({
      from_user: userId,
      to_user: targetProfile.id,
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
  }, [myPublicId, queryClient, targetInviteId, userId]);

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

      const nextTarget = formatUserDisplay(invite.from_user);
      setTargetInviteId(nextTarget === "-" ? "" : nextTarget);
      setCurrentGameId(gameData.id);
      setFinishedResultTitle(null);
      void queryClient.invalidateQueries({
        queryKey: ["incomingInvites", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["outgoingInvites", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      void queryClient.invalidateQueries({ queryKey: ["moves", gameData.id] });
    },
    [formatUserDisplay, queryClient, userId],
  );

  const placeStone = useCallback(
    async (x: number, y: number, options?: PlaceStoneOptions) => {
      if (!supabase || !activeGame || !userId) {
        return;
      }

      if (activeGame.status !== "playing") {
        return;
      }

      if (activeGame.current_turn !== userId) {
        if (!options?.silent) {
          setErrorMessage("还没轮到你落子");
        }
        return;
      }

      if (board[y][x]) {
        if (!options?.silent) {
          setErrorMessage("该位置已有棋子");
        }
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
        if (!options?.silent) {
          setErrorMessage(`落子失败: ${moveError?.message ?? "未知错误"}`);
        }
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
        if (!options?.silent) {
          setErrorMessage(`更新对局状态失败: ${gameError.message}`);
        }
        return;
      }

      queryClient.setQueryData<Move[]>(["moves", activeGame.id], nextMoves);

      if (updatePayload.status === "finished") {
        const nextTarget = formatUserDisplay(getOpponent(activeGame, userId));
        setTargetInviteId(nextTarget === "-" ? "" : nextTarget);
        setFinishedResultTitle(winner ? "Victory" : draw ? "Draw" : null);
        setCurrentGameId(null);
        setNotice("本局已结束，已释放本局实时连接。若要继续请重新邀请。");
        setTimeout(() => setNotice(null), 1800);
      }

      void queryClient.invalidateQueries({ queryKey: ["activeGame", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["moves", activeGame.id],
      });
    },
    [activeGame, board, formatUserDisplay, moves, queryClient, userId],
  );

  useEffect(() => {
    if (
      !activeGame ||
      !userId ||
      activeGame.status !== "playing" ||
      !isMyTurn
    ) {
      setTurnCountdown(0);
      turnAnchorRef.current = null;
      turnDeadlineRef.current = null;
      autoMoveLockRef.current = null;
      return;
    }

    const turnAnchor = `${activeGame.id}:${activeGame.current_turn}:${moves.length}`;
    if (turnAnchorRef.current !== turnAnchor) {
      turnAnchorRef.current = turnAnchor;
      turnDeadlineRef.current = Date.now() + TURN_SECONDS * 1000;
      autoMoveLockRef.current = null;
    }

    const tick = () => {
      const deadline = turnDeadlineRef.current;
      if (!deadline) {
        setTurnCountdown(0);
        return;
      }

      const leftMs = deadline - Date.now();
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
      setTurnCountdown(leftSec);

      if (leftMs > 0) {
        return;
      }

      const autoMoveKey = `${activeGame.id}:${moves.length}:${userId}`;
      if (autoMoveLockRef.current === autoMoveKey) {
        return;
      }
      autoMoveLockRef.current = autoMoveKey;

      const emptyCells: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
          if (!board[y][x]) {
            emptyCells.push({ x, y });
          }
        }
      }

      if (emptyCells.length === 0) {
        return;
      }

      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const target = emptyCells[randomIndex];
      void placeStone(target.x, target.y, { silent: true });
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeGame, board, isMyTurn, moves.length, placeStone, userId]);

  return {
    isSupabaseConfigured,
    board,
    userId,
    myPublicId,
    publicIdDraft,
    incomingInvites,
    outgoingInvites,
    activeGame,
    loading,
    busy,
    notice,
    errorMessage,
    myColor,
    opponentId: opponentDisplayId,
    finishedResultTitle,
    targetInviteId,
    turnCountdown,
    isMyTurn,
    syncMode,
    copyUserId,
    disconnectRealtime,
    reconnectRealtime,
    setPublicIdDraft,
    savePublicId,
    setTargetInviteId,
    formatUserDisplay,
    sendInvite,
    respondInvite,
    placeStone,
    clearError: () => setErrorMessage(null),
  };
}
