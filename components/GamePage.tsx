'use client';

import { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 840;
const CANVAS_HEIGHT = 560;

const INITIAL_SPEED = 2.4;
const MAX_SPEED = 9;
const HIT_SPEED_MULTIPLIER = 1.06;

// 08:00 → 20:00 in 30-min slots => 12h * 2 = 24 slots
const SLOTS_PER_DAY = 24;

type GameState = {
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  paddleX: number;
  ballFrozenUntil: number | null;
};

type MeetingBrick = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  active: boolean;
};

const MEETING_TITLES = [
  'Daily Standup',
  'Sprint Planning',
  'Retro about Retro',
  'PR Review Marathon',
  'Sync about Syncing',
  'Tech Debt Session',
  'Alignment Meeting',
  'Cross-Team Check-In',
  'Roadmap Deep Dive',
  'Incident Postmortem',
  'Quarterly All-Hands',
  'Stakeholder Sync',
  'Refinement (Again)',
  'Architecture Council',
  'QA Assistance',
  'Design Handoff',
  'Backlog Grooming',
  'Mandatory Fun',
  'Ad-hoc Sync',
  'Calendar Cleanup',
];

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

  const triggerGameOver = () => {
    setGameOverMessage('Game over. You now have to attend the remaining meetings :D');

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
    gameOverTimeoutRef.current = window.setTimeout(() => {
      setGameOverMessage(null);
    }, 2500);
  };

  const generateMeetingBricks = () => {
    const bricks: MeetingBrick[] = [];

    const headerHeight = 56;
    const footerHeight = 32;
    const leftGutter = 56;
    const gridTop = headerHeight;
    const gridBottom = CANVAS_HEIGHT - footerHeight - 40;
    const gridHeight = gridBottom - gridTop;
    const gridWidth = CANVAS_WIDTH - leftGutter;

    const cols = 7;
    const slotsPerDay = SLOTS_PER_DAY;

    const colWidth = gridWidth / cols;
    const slotHeight = gridHeight / slotsPerDay;

    let id = 0;

    // meetings only in upper part of the day so there's a gap at the bottom
    const maxDurationSlots = 6; // up to 3h
    const lastMeetingEndSlot = slotsPerDay - 6; // leave 3h (6 slots) free at bottom
    const maxStartSlot = lastMeetingEndSlot - maxDurationSlots;

    for (let day = 0; day < cols; day++) {
      const meetingsForDay = randomInt(2, 5); // 2–4 meetings per day

      let attempts = 0;
      let created = 0;

      while (created < meetingsForDay && attempts < 25) {
        attempts++;

        const startSlot = randomInt(0, Math.max(0, maxStartSlot));
        const durationSlots = randomInt(1, maxDurationSlots);
        const endSlot = Math.min(slotsPerDay, startSlot + durationSlots);

        const paddingX = 6;
        const paddingY = 4;

        const x = leftGutter + day * colWidth + paddingX;
        const y = gridTop + startSlot * slotHeight + paddingY;
        const width = colWidth - paddingX * 2;
        const height = (endSlot - startSlot) * slotHeight - paddingY * 2;

        const overlaps = bricks.some(
          (b) =>
            b.active &&
            Math.abs(b.x - x) < 1 &&
            rectsOverlap(
              { x, y, width, height },
              { x: b.x, y: b.y, width: b.width, height: b.height }
            )
        );

        if (overlaps) continue;

        const titleIndex = (id + day + startSlot) % MEETING_TITLES.length;
        const title = MEETING_TITLES[titleIndex];

        bricks.push({
          id,
          x,
          y,
          width,
          height,
          title,
          active: true,
        });

        id++;
        created++;
      }
    }

    bricksRef.current = bricks;
    setRemainingMeetings(bricks.length);
    remainingMeetingsRef.current = bricks.length;
  };

  const startGame = () => {
    if (!name.trim()) return;

    setHasStarted(true);

    setTimeout(() => {
      generateMeetingBricks();

      const now = performance.now();

      const initialState: GameState = {
        ballX: CANVAS_WIDTH / 2,
        ballY: CANVAS_HEIGHT - 80,
        ballVX: 0,
        ballVY: 0,
        paddleX: CANVAS_WIDTH / 2,
        ballFrozenUntil: now + 3000, // 3s delay
      };

      setBallVelocityWithSpeed(initialState, INITIAL_SPEED);
      gameStateRef.current = initialState;

      startLoop();
    }, 0);
  };

  const resetGame = () => {
    generateMeetingBricks();
    const now = performance.now();

    if (!gameStateRef.current) {
      const newState: GameState = {
        ballX: CANVAS_WIDTH / 2,
        ballY: CANVAS_HEIGHT - 80,
        ballVX: 0,
        ballVY: 0,
        paddleX: CANVAS_WIDTH / 2,
        ballFrozenUntil: now + 2000,
      };
      setBallVelocityWithSpeed(newState, INITIAL_SPEED);
      gameStateRef.current = newState;
    } else {
      const state = gameStateRef.current;
      state.ballX = CANVAS_WIDTH / 2;
      state.ballY = CANVAS_HEIGHT - 80;
      state.paddleX = CANVAS_WIDTH / 2;
      state.ballFrozenUntil = now + 2000;
      setBallVelocityWithSpeed(state, INITIAL_SPEED);
    }

    if (animationFrameRef.current === null) {
      startLoop();
    }
  };

  const startLoop = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const loop = () => {
      updateGame();
      drawGame();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
  };

  const updateGame = () => {
    const state = gameStateRef.current;
    if (!state) return;

    // Endgame: all meetings cleared → freeze ball
    if (remainingMeetingsRef.current <= 0) {
      return;
    }

    const paddleWidth = 140;
    const paddleHeight = 16;
    const paddleY = CANVAS_HEIGHT - 40;
    const ballRadius = 8;

    const now = performance.now();
    if (state.ballFrozenUntil && now < state.ballFrozenUntil) {
      return;
    } else if (state.ballFrozenUntil && now >= state.ballFrozenUntil) {
      state.ballFrozenUntil = null;
    }

    // Move ball
    state.ballX += state.ballVX;
    state.ballY += state.ballVY;

    // Wall collisions (left/right)
    if (state.ballX - ballRadius < 0) {
      state.ballX = ballRadius;
      state.ballVX *= -1;
    }
    if (state.ballX + ballRadius > CANVAS_WIDTH) {
      state.ballX = CANVAS_WIDTH - ballRadius;
      state.ballVX *= -1;
    }

    // Ceiling
    if (state.ballY - ballRadius < 0) {
      state.ballY = ballRadius;
      state.ballVY *= -1;
    }

    // Paddle collision
    const paddleLeft = state.paddleX - paddleWidth / 2;
    const paddleRight = state.paddleX + paddleWidth / 2;
    const paddleTop = paddleY;
    const paddleBottom = paddleY + paddleHeight;

    const ballBottom = state.ballY + ballRadius;

    if (
      ballBottom >= paddleTop &&
      state.ballY <= paddleBottom &&
      state.ballX >= paddleLeft &&
      state.ballX <= paddleRight &&
      state.ballVY > 0
    ) {
      state.ballY = paddleTop - ballRadius;

      const speed =
        Math.sqrt(state.ballVX * state.ballVX + state.ballVY * state.ballVY) ||
        INITIAL_SPEED;

      const hitOffset = (state.ballX - state.paddleX) / (paddleWidth / 2); // -1..1
      const clampedOffset = clamp(hitOffset, -1, 1);

      const newVX = clampedOffset * speed;
      const remaining = Math.max(speed * speed - newVX * newVX, 0.5);
      const newVY = -Math.sqrt(remaining);

      state.ballVX = newVX;
      state.ballVY = newVY;
    }

    // Meeting bricks collision
    handleBrickCollisions(state, ballRadius);

    // Ball falls below paddle → GAME OVER
    if (state.ballY - ballRadius > CANVAS_HEIGHT) {
      triggerGameOver();
    }
  };

  const handleBrickCollisions = (state: GameState, ballRadius: number) => {
    const bricks = bricksRef.current;
    if (!bricks.length) return;

    for (let i = 0; i < bricks.length; i++) {
      const brick = bricks[i];
      if (!brick.active) continue;

      const { x, y, width, height, title } = brick;

      const closestX = clamp(state.ballX, x, x + width);
      const closestY = clamp(state.ballY, y, y + height);

      const distX = state.ballX - closestX;
      const distY = state.ballY - closestY;
      const distanceSquared = distX * distX + distY * distY;

      if (distanceSquared <= ballRadius * ballRadius) {
        brick.active = false;
        showMeetingCanceledToast(title);

        setRemainingMeetings((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          remainingMeetingsRef.current = next;
          return next;
        });

        const overlapLeft = Math.abs(state.ballX - x);
        const overlapRight = Math.abs(state.ballX - (x + width));
        const overlapTop = Math.abs(state.ballY - y);
        const overlapBottom = Math.abs(state.ballY - (y + height));

        const minOverlap = Math.min(
          overlapLeft,
          overlapRight,
          overlapTop,
          overlapBottom
        );

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          state.ballVX *= -1;
        } else {
          state.ballVY *= -1;
        }

        // Speed up after each meeting hit
        const currentSpeed = Math.sqrt(
          state.ballVX * state.ballVX + state.ballVY * state.ballVY
        );
        const targetSpeed = Math.min(
          MAX_SPEED,
          currentSpeed * HIT_SPEED_MULTIPLIER
        );

        if (currentSpeed > 0 && targetSpeed > currentSpeed) {
          const factor = targetSpeed / currentSpeed;
          state.ballVX *= factor;
          state.ballVY *= factor;
        }

        break;
      }
    }
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paddleWidth = 140;
    const paddleHeight = 16;
    const paddleY = CANVAS_HEIGHT - 40;
    const ballRadius = 8;

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
      `Dev Calendar – ${name || 'Anonymous Hero'}`,
      16,
      headerHeight / 2 - 4
    );

    // Meeting counter
    ctx.font =
      '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'start';
    ctx.fillText(
      `${remainingMeetings} meeting${
        remainingMeetings === 1 ? '' : 's'
      } remaining`,
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
      const y = gridTop + index * (gridHeight / (SLOT_LABELS.length - 1));
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

      ctx.font =
        '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = '#111827';
      const paddingX = 6;
      const paddingY = 12;
      const maxWidth = brick.width - paddingX * 2;
      const title =
        brick.title.length > 22
          ? brick.title.slice(0, 21) + '…'
          : brick.title;

      ctx.fillText(title, brick.x + paddingX, brick.y + paddingY, maxWidth);
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
      'Move your mouse (or use ← →) to control the paddle. Hit meetings to cancel them.',
      16,
      CANVAS_HEIGHT - 10
    );
  };

  // Mouse controls paddle – corrected for fullscreen scaling
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = gameStateRef.current;
    const canvas = canvasRef.current;
    if (!state || !hasStarted || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relativeX = e.clientX - rect.left; // 0..rect.width
    const normalizedX = (relativeX / rect.width) * CANVAS_WIDTH; // 0..CANVAS_WIDTH

    const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, normalizedX));
    state.paddleX = clampedX;
  };

  useEffect(() => {
    if (!hasStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;

      const step = 24;

      if (e.key === 'ArrowLeft') {
        state.paddleX = Math.max(0, state.paddleX - step);
      } else if (e.key === 'ArrowRight') {
        state.paddleX = Math.min(CANVAS_WIDTH, state.paddleX + step);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (gameOverTimeoutRef.current !== null) {
        window.clearTimeout(gameOverTimeoutRef.current);
      }
    };
  }, []);

  const allCleared = hasStarted && remainingMeetings === 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Name / start overlay */}
      {!hasStarted && (
        <div className="mb-10 w-full max-w-md z-10">
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
            <h1 className="text-2xl font-semibold mb-2">
              Cancel All Meetings 🎯
            </h1>
            <p className="text-sm text-slate-300 mb-4">
              A tiny arcade game for developers drowning in calendar invites.
              Enter your name and start canceling your schedule.
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
              🎉 All meetings canceled. You own your calendar again.
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
        className={
          hasStarted
            ? 'fixed inset-0 flex items-center justify-center bg-slate-950'
            : 'border border-slate-800 rounded-3xl shadow-2xl bg-slate-900/70 backdrop-blur p-4'
        }
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          className={
            hasStarted
              ? 'rounded-2xl bg-slate-950 shadow-2xl w-[min(100vw-40px,1100px)] h-auto'
              : 'rounded-2xl bg-slate-950'
          }
        />
      </div>
    </main>
  );
}

/* Helpers */

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return !(
    a.x + a.width <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  );
}

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

function setBallVelocityWithSpeed(state: GameState, speed: number) {
  const minAngle = (-75 * Math.PI) / 180;
  const maxAngle = (-45 * Math.PI) / 180;
  const angle = minAngle + Math.random() * (maxAngle - minAngle);

  state.ballVX = Math.cos(angle) * speed;
  state.ballVY = Math.sin(angle) * speed;
}
