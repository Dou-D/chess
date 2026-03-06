import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type GameFinishOverlayProps = {
  visible: boolean;
  title: string;
  countdown: number;
  myReady: boolean;
  opponentReady: boolean;
  rematchAvailable: boolean;
  busy: boolean;
  onRematch: () => void;
  onExit: () => void;
};

export function GameFinishOverlay({
  visible,
  title,
  countdown,
  myReady,
  opponentReady,
  rematchAvailable,
  busy,
  onRematch,
  onExit,
}: GameFinishOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (
      !visible ||
      !rootRef.current ||
      !titleRef.current ||
      !actionRef.current
    ) {
      return;
    }

    const timeline = gsap.timeline();
    timeline
      .fromTo(
        rootRef.current,
        {
          opacity: 0,
          backdropFilter: "blur(0px)",
          backgroundColor: "rgba(28,25,23,0)",
        },
        {
          opacity: 1,
          backdropFilter: "blur(6px)",
          backgroundColor: "rgba(28,25,23,0.62)",
          duration: 0.28,
          ease: "power2.out",
        },
      )
      .fromTo(
        titleRef.current,
        { y: 24, opacity: 0, scale: 0.92, rotateX: -18 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          rotateX: 0,
          duration: 0.45,
          ease: "back.out(1.7)",
        },
        "<+0.05",
      )
      .fromTo(
        actionRef.current,
        { y: 14, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.28,
          ease: "power2.out",
        },
        "<+0.05",
      );

    return () => {
      timeline.kill();
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const titleClass =
    title === "Victory"
      ? "text-emerald-600"
      : title === "Defeat"
        ? "text-rose-600"
        : "text-stone-900";
  const readyCount = Number(myReady) + Number(opponentReady);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-10 flex items-center justify-center rounded-lg p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-5 text-center shadow-2xl">
        <h3
          ref={titleRef}
          className={`text-2xl font-extrabold tracking-tight ${titleClass}`}
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          双方都选择再来一局才会立即开新局。
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant={myReady ? "success" : "secondary"}>
            你: {myReady ? "已确认" : "未确认"}
          </Badge>
          <Badge variant={opponentReady ? "success" : "secondary"}>
            对手: {opponentReady ? "已确认" : "未确认"}
          </Badge>
          <Badge variant={readyCount === 2 ? "success" : "default"}>
            准备进度: {readyCount}/2
          </Badge>
        </div>

        <p className="mt-3 text-sm text-stone-700">
          {!rematchAvailable
            ? "再来一局功能未初始化，请先执行最新 schema.sql。"
            : countdown > 0
              ? readyCount < 2
                ? `已就绪 ${readyCount}/2，等待对方加入（剩余 ${countdown} 秒）`
                : "双方就绪，正在开始下一局..."
              : "已超时，正在关闭连接"}
        </p>

        <div
          ref={actionRef}
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center"
        >
          <Button
            disabled={busy || myReady || !rematchAvailable}
            onClick={onRematch}
          >
            再来一局
          </Button>
          <Button variant="destructive" disabled={busy} onClick={onExit}>
            结束并断开连接
          </Button>
        </div>
      </div>
    </div>
  );
}
