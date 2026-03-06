import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { BOARD_SIZE } from "../../types/game";

type GomokuCanvasProps = {
  board: (string | null)[][];
  blackPlayerId: string | null;
  disabled: boolean;
  onPlaceStone: (x: number, y: number) => void;
};

const MIN_CANVAS_SIZE = 320;
const MAX_CANVAS_SIZE = 680;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function GomokuCanvas({
  board,
  blackPlayerId,
  disabled,
  onPlaceStone,
}: GomokuCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const boardCacheRef = useRef<HTMLCanvasElement | null>(null);
  const boardCacheKeyRef = useRef<string>("");
  const [canvasSize, setCanvasSize] = useState(MIN_CANVAS_SIZE);

  const stones = useMemo(() => {
    const cells: Array<{ x: number; y: number; isBlack: boolean }> = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = board[y][x];
        if (!cell) {
          continue;
        }

        cells.push({
          x,
          y,
          isBlack: blackPlayerId ? cell === blackPlayerId : false,
        });
      }
    }

    return cells;
  }, [blackPlayerId, board]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const updateSize = () => {
      const next = clamp(host.clientWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
      setCanvasSize(next);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const displaySize = canvasSize;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = Math.floor(displaySize * dpr);
    canvas.height = Math.floor(displaySize * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const margin = displaySize * 0.06;
    const cell = (displaySize - margin * 2) / (BOARD_SIZE - 1);
    const boardMin = margin;
    const boardMax = margin + cell * (BOARD_SIZE - 1);

    const cacheKey = `${displaySize}:${dpr}`;
    if (boardCacheKeyRef.current !== cacheKey || !boardCacheRef.current) {
      const cacheCanvas = document.createElement("canvas");
      cacheCanvas.width = canvas.width;
      cacheCanvas.height = canvas.height;
      const cacheCtx = cacheCanvas.getContext("2d");
      if (!cacheCtx) {
        return;
      }

      cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cacheCtx.clearRect(0, 0, displaySize, displaySize);

      const boardGradient = cacheCtx.createLinearGradient(
        0,
        0,
        displaySize,
        displaySize,
      );
      boardGradient.addColorStop(0, "#f5d79a");
      boardGradient.addColorStop(1, "#e9bc6d");
      cacheCtx.fillStyle = boardGradient;
      cacheCtx.fillRect(0, 0, displaySize, displaySize);

      cacheCtx.strokeStyle = "rgba(92, 55, 10, 0.85)";
      cacheCtx.lineWidth = 1;
      for (let i = 0; i < BOARD_SIZE; i += 1) {
        const p = margin + i * cell;
        cacheCtx.beginPath();
        cacheCtx.moveTo(boardMin, p);
        cacheCtx.lineTo(boardMax, p);
        cacheCtx.stroke();

        cacheCtx.beginPath();
        cacheCtx.moveTo(p, boardMin);
        cacheCtx.lineTo(p, boardMax);
        cacheCtx.stroke();
      }

      const starPoints = [3, 7, 11];
      cacheCtx.fillStyle = "rgba(92, 55, 10, 0.9)";
      for (const gx of starPoints) {
        for (const gy of starPoints) {
          const x = margin + gx * cell;
          const y = margin + gy * cell;
          cacheCtx.beginPath();
          cacheCtx.arc(x, y, Math.max(2.5, cell * 0.1), 0, Math.PI * 2);
          cacheCtx.fill();
        }
      }

      boardCacheRef.current = cacheCanvas;
      boardCacheKeyRef.current = cacheKey;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (boardCacheRef.current) {
      ctx.drawImage(boardCacheRef.current, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const stone of stones) {
      const cx = margin + stone.x * cell;
      const cy = margin + stone.y * cell;
      const radius = cell * 0.42;

      const gradient = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.18,
        cx,
        cy,
        radius,
      );

      if (stone.isBlack) {
        gradient.addColorStop(0, "#5f5f5f");
        gradient.addColorStop(1, "#0f0f0f");
      } else {
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(1, "#dedede");
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = stone.isBlack
        ? "rgba(8,8,8,0.7)"
        : "rgba(50,50,50,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [canvasSize, stones]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const margin = canvasSize * 0.06;
    const cell = (canvasSize - margin * 2) / (BOARD_SIZE - 1);
    const x = clamp(Math.round((clickX - margin) / cell), 0, BOARD_SIZE - 1);
    const y = clamp(Math.round((clickY - margin) / cell), 0, BOARD_SIZE - 1);

    onPlaceStone(x, y);
  };

  return (
    <div ref={hostRef} className="mx-auto w-full max-w-[680px]">
      <canvas
        ref={canvasRef}
        className={`mx-auto block rounded-md border border-amber-900/80 shadow-sm ${
          disabled ? "cursor-not-allowed" : "cursor-crosshair"
        }`}
        style={{ backgroundColor: "#f5d79a" }}
        role="img"
        aria-label="Gomoku Board Canvas"
        onClick={handleCanvasClick}
      />
    </div>
  );
}
