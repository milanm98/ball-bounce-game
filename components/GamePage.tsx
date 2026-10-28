'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createTextFitter } from '../lib/canvas-text';
import { createMeetingCalendar, MILAN_GAME_OVER_MESSAGE, MILAN_MEETING_TITLE, SLOTS_PER_DAY } from '../lib/meetings';

import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_Y,
  BALL_RADIUS, clampPaddle, createGame, createFrameClock, stepGame,
  type GameState, type MeetingBrick,
} from '../lib/game';

const fitText = createTextFitter();

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SLOT_LABELS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export default function GamePage() {
  const [name, setName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  const [canceledTitle, setCanceledTitle] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [remainingMeetings, setRemainingMeetings] = useState(0);

  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);

  const [milanGameOver, setMilanGameOver] = useState(false);
  const milanDialogRef = useRef<HTMLDialogElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const bricksRef = useRef<MeetingBrick[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const remainingMeetingsRef = useRef(0);
  const gameOverTimeoutRef = useRef<number | null>(null);

  const showMeetingCanceledToast = (title: string) => {
    setCanceledTitle(title);
    setShowToast(true);

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false);
    }, 1200);
  };

  const triggerGameOver = (hitMilan = false) => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    setShowToast(false);
    setMilanGameOver(hitMilan);
    setGameOverMessage(hitMilan ? null : 'Game over. You now have to attend the remaining meetings :D');

    // Stop loop and reset to start screen
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    gameStateRef.current = null;
    bricksRef.current = [];
    setRemainingMeetings(0);
    remainingMeetingsRef.current = 0;

    // Go back to intro UI
    setHasStarted(false);

    if (gameOverTimeoutRef.current) {
      window.clearTimeout(gameOverTimeoutRef.current);
    }
    gameOverTimeoutRef.current = hitMilan ? null : window.setTimeout(() => {
      setGameOverMessage(null);
    }, 2500);
  };

  const generateMeetingBricks = () => {
    const bricks = createMeetingCalendar();
    const cancelableCount = bricks.filter(brick => !brick.isMilan).length;
    bricksRef.current = bricks;
    setRemainingMeetings(cancelableCount);
    remainingMeetingsRef.current = cancelableCount;
  };

  const startGame = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    if (gameStateRef.current) return;
    clearRoundMessages();
    generateMeetingBricks();
    gameStateRef.current = createGame(event.timeStamp, 3000);
    setHasStarted(true);
    startLoop();
  };

  const clearRoundMessages = () => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    if (gameOverTimeoutRef.current !== null) window.clearTimeout(gameOverTimeoutRef.current);
    toastTimeoutRef.current = null;
    gameOverTimeoutRef.current = null;
    setShowToast(false);
    setCanceledTitle(null);
    setGameOverMessage(null);
    setMilanGameOver(false);
  };

  const resetGame = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearRoundMessages();
    generateMeetingBricks();
    gameStateRef.current = createGame(event.timeStamp, 2000);
    startLoop();
  };

  const startLoop = () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const clock = createFrameClock();
    const loop = (now: number) => {
      animationFrameRef.current = null;
      if (!gameStateRef.current) return;
      if (document.hidden) {
        clock.reset();
      } else {
        const steps = clock.advance(now);
        for (let i = 0; i < steps; i++) {
          const state = gameStateRef.current;
          if (!state || remainingMeetingsRef.current === 0) break;
          const result = stepGame(state, bricksRef.current, now);
          if (result.lost) {
            triggerGameOver(result.hit?.isMilan ?? false);
            return;
          }
          if (result.hit) {
            remainingMeetingsRef.current = Math.max(0, remainingMeetingsRef.current - 1);
            setRemainingMeetings(remainingMeetingsRef.current);
            showMeetingCanceledToast(result.hit.title);
          }
        }
        drawGame();
      }
      if (gameStateRef.current && remainingMeetingsRef.current > 0) {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match the backing buffer to the displayed size for sharp text on large
    // and high-DPI screens, while keeping physics in 840 x 560 coordinates.
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * pixelRatio);
    const height = Math.round(rect.height * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(width / CANVAS_WIDTH, 0, 0, height / CANVAS_HEIGHT, 0, 0);

    const paddleWidth = PADDLE_WIDTH;
    const paddleHeight = PADDLE_HEIGHT;
    const paddleY = PADDLE_Y;
    const ballRadius = BALL_RADIUS;

    const headerHeight = 56;
    const footerHeight = 32;
    const leftGutter = 56;
    const gridTop = headerHeight;
    const gridBottom = CANVAS_HEIGHT - footerHeight - 40;
    const gridHeight = gridBottom - gridTop;
    const gridWidth = CANVAS_WIDTH - leftGutter;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Outer background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Calendar background (main grid area)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(leftGutter, gridTop, gridWidth, gridHeight);

    // 🩹 Dark gutter fix so 08:00 isn’t on white
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, gridTop, leftGutter, gridHeight);

    // Header background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, CANVAS_WIDTH, headerHeight);

    // Header title
    ctx.font =
      '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      fitText(ctx, `Dev Calendar – ${name || 'Anonymous Hero'}`, CANVAS_WIDTH - 222),
      16,
      headerHeight / 2 - 4
    );

    // The animation callback outlives React renders, so read the live count.
    const remainingMeetings = remainingMeetingsRef.current;
    ctx.font =
      '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'start';
    ctx.fillText(
      `${remainingMeetings} meeting${
        remainingMeetings === 1 ? '' : 's'
      } to cancel`,
      CANVAS_WIDTH - 190,
      headerHeight / 2 - 4
    );

    // Day labels
    const cols = 7;
    const colWidth = gridWidth / cols;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    for (let i = 0; i < cols; i++) {
      const dayLabel = DAY_LABELS[i] ?? '';
      const xCenter = leftGutter + i * colWidth + colWidth / 2;

      if (i === 2) {
        ctx.fillStyle = '#eff6ff';
        ctx.fillRect(leftGutter + i * colWidth, headerHeight - 24, colWidth, 24);
        ctx.fillStyle = '#1d4ed8';
      } else {
        ctx.fillStyle = '#4b5563';
      }

      ctx.fillText(dayLabel, xCenter, headerHeight - 12);
    }

    // Time labels
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e5e7eb';
    const slotsPerDay = SLOTS_PER_DAY;
    const slotHeight = gridHeight / slotsPerDay;

    SLOT_LABELS.forEach((label, index) => {
      const y = Math.max(gridTop + 7, Math.min(gridBottom - 7,
        gridTop + index * (gridHeight / (SLOT_LABELS.length - 1))));
      ctx.fillText(label, leftGutter - 8, y);
    });

    // Grid lines
    ctx.textAlign = 'start';
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let i = 0; i <= cols; i++) {
      const x = leftGutter + colWidth * i;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridBottom);
      ctx.stroke();
    }

    // Horizontal lines
    ctx.strokeStyle = '#f3f4f6';
    for (let slot = 0; slot <= slotsPerDay; slot++) {
      const y = gridTop + slot * slotHeight;
      ctx.beginPath();
      ctx.moveTo(leftGutter, y);
      ctx.lineTo(leftGutter + gridWidth, y);
      ctx.stroke();
    }

    // Meetings
    const bricks = bricksRef.current;
    const colors = ['#bfdbfe', '#a7f3d0', '#fde68a', '#fed7aa', '#e9d5ff'];

    bricks.forEach((brick, index) => {
      if (!brick.active) return;

      const color = colors[index % colors.length];

      ctx.fillStyle = color;
      roundRect(ctx, brick.x, brick.y, brick.width, brick.height, 6);
      ctx.fill();

      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      roundRect(ctx, brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 5);
      ctx.clip();
      const fontSize = Math.min(11, brick.height - 4);
      ctx.font =
        `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = '#111827';
      const paddingX = 6;
      const maxWidth = brick.width - paddingX * 2;
      const title = fitText(ctx, brick.title, maxWidth);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelY = brick.y + Math.min(brick.height / 2, 4 + fontSize / 2);
      ctx.fillText(title, brick.x + paddingX, labelY);
      ctx.restore();
    });

    // Paddle
    ctx.fillStyle = '#0ea5e9';
    roundRect(
      ctx,
      state.paddleX - paddleWidth / 2,
      paddleY,
      paddleWidth,
      paddleHeight,
      8
    );
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.arc(state.ballX, state.ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    // Footer hint
    ctx.font =
      '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'start';
    ctx.fillText(
      'Move your mouse (or use ← →) to control the paddle. Cancel meetings; avoid the two meetings with Milan.',
      16,
      CANVAS_HEIGHT - 10
    );
  };

  const redrawCanvas = useEffectEvent(() => drawGame());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => redrawCanvas());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Mouse controls paddle – corrected for fullscreen scaling
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = gameStateRef.current;
    const canvas = canvasRef.current;
    if (!state || !hasStarted || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relativeX = e.clientX - rect.left; // 0..rect.width
    const normalizedX = (relativeX / rect.width) * CANVAS_WIDTH; // 0..CANVAS_WIDTH

    const clampedX = clampPaddle(normalizedX);
    state.paddleX = clampedX;
  };

  useEffect(() => {
    if (!hasStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;

      const step = 24;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        state.paddleX = clampPaddle(state.paddleX + (e.key === 'ArrowLeft' ? -step : step));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted]);

  useEffect(() => {
    return () => {
      gameStateRef.current = null;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (gameOverTimeoutRef.current !== null) {
        window.clearTimeout(gameOverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const dialog = milanDialogRef.current;
    if (!dialog) return;
    if (milanGameOver && !dialog.open) dialog.showModal();
    else if (!milanGameOver && dialog.open) dialog.close();
  }, [milanGameOver]);

  const allCleared = hasStarted && remainingMeetings === 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Name / start overlay */}
      {!hasStarted && (
        <div className="w-full max-w-md z-10 py-6">
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
            <h1 className="text-2xl font-semibold mb-2">
              Cancel All Meetings 🎯
            </h1>
            <p className="text-sm text-slate-300 mb-4">
              A tiny arcade game for developers drowning in calendar invites.
              Enter your name and start canceling your schedule.
            </p>

            <p className="text-sm text-slate-300 mb-4">
              Every calendar has two “{MILAN_MEETING_TITLE}” meetings,
              placed far apart. Hit either one and it’s game over! Cancel the
              other meetings and leave both Milan meetings untouched.
            </p>

            <label className="block text-sm mb-1" htmlFor="player-name">
              Your name
            </label>
            <input
              id="player-name"
              className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-700 outline-none text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              placeholder="Dev with 37 meetings"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <button
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 px-4 py-2 text-sm font-medium text-slate-950 w-full transition disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={startGame}
              disabled={!name.trim()}
            >
              Start smashing meetings
            </button>

            <p className="mt-3 text-[11px] text-slate-400">
              No login. No tracking. Just you, a paddle, and a very unlucky
              calendar.
            </p>
          </div>
        </div>
      )}

      {milanGameOver && <dialog
        ref={milanDialogRef}
        aria-labelledby="milan-game-over-title"
        aria-describedby="milan-game-over-message"
        onCancel={() => setMilanGameOver(false)}
        onClose={() => setMilanGameOver(false)}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-rose-400 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <h2 id="milan-game-over-title" className="text-xl font-semibold mb-3">Game over</h2>
        <p id="milan-game-over-message" className="text-sm leading-relaxed mb-5">{MILAN_GAME_OVER_MESSAGE}</p>
        <button type="button" onClick={startGame}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
          Try again
        </button>
      </dialog>}

      {/* Toast: meeting canceled */}
      {showToast && canceledTitle && (
        <div className="pointer-events-none fixed top-6 inset-x-0 flex justify-center z-20">
          <div className="bg-emerald-500 text-emerald-950 text-xs font-medium px-4 py-2 rounded-full shadow-lg border border-emerald-600 flex items-center gap-2">
            <span>✅ Meeting canceled:</span>
            <span className="font-semibold">{canceledTitle}</span>
          </div>
        </div>
      )}

      {/* Game over toast */}
      {gameOverMessage && (
        <div className="pointer-events-none fixed top-16 inset-x-0 flex justify-center z-30">
          <div className="bg-rose-500 text-rose-950 text-xs font-medium px-4 py-2 rounded-full shadow-lg border border-rose-600 flex items-center gap-2">
            <span>💀 {gameOverMessage}</span>
          </div>
        </div>
      )}

      {/* All cleared overlay with CTA */}
      {allCleared && (
        <div className="fixed top-16 inset-x-0 flex justify-center z-20">
          <div className="bg-sky-500/95 text-slate-950 text-sm px-5 py-3 rounded-full shadow-lg border border-sky-600 flex items-center gap-4">
            <span className="font-semibold">
              🎉 All regular meetings canceled. Milan’s meme chats are safe.
            </span>
            <button
              onClick={resetGame}
              className="pointer-events-auto rounded-full bg-slate-900/90 text-slate-100 text-xs font-medium px-3 py-1 border border-slate-800 hover:bg-slate-800 transition"
            >
              New day
            </button>
          </div>
        </div>
      )}

      {/* Game area – fullscreen when started */}
      <div
        className={hasStarted ? 'fixed inset-0 flex items-center justify-center bg-slate-950' : 'hidden'}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          className={
            hasStarted
              ? 'game-canvas rounded-2xl bg-slate-950 shadow-2xl'
              : 'rounded-2xl bg-slate-950'
          }
        />
      </div>
    </main>
  );
}

/* Helpers */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
