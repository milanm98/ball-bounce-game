export const CANVAS_WIDTH = 840;
export const CANVAS_HEIGHT = 560;
export const PADDLE_WIDTH = 140;
export const PADDLE_HEIGHT = 16;
export const PADDLE_Y = CANVAS_HEIGHT - 40;
export const BALL_RADIUS = 8;
export const INITIAL_SPEED = 3;
export const MAX_SPEED = 9;
const HIT_SPEED_MULTIPLIER = 1.06;
export const FRAME_MS = 1000 / 60;

export type GameState = {
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  paddleX: number;
  ballFrozenUntil: number | null;
};

export type MeetingBrick = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  active: boolean;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampPaddle(x: number) {
  return clamp(x, PADDLE_WIDTH / 2, CANVAS_WIDTH - PADDLE_WIDTH / 2);
}

export function createGame(now: number, delay: number): GameState {
  const angle = (-75 + Math.random() * 30) * Math.PI / 180;
  return {
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT - 80,
    ballVX: Math.cos(angle) * INITIAL_SPEED,
    ballVY: Math.sin(angle) * INITIAL_SPEED,
    paddleX: CANVAS_WIDTH / 2,
    ballFrozenUntil: now + delay,
  };
}

// Accumulate 60 Hz physics steps independently of the display refresh rate.
// Drop long gaps (background tabs, sleep) rather than fast-forwarding a round.
export function createFrameClock() {
  let previous: number | null = null;
  let accumulated = 0;
  return {
    reset() {
      previous = null;
      accumulated = 0;
    },
    advance(now: number) {
      if (previous === null) {
        previous = now;
        return 0;
      }
      const elapsed = now - previous;
      previous = now;
      if (elapsed < 0 || elapsed > 100) {
        accumulated = 0;
        return 0;
      }
      accumulated += elapsed;
      const steps = Math.floor((accumulated + 1e-7) / FRAME_MS);
      accumulated = Math.max(0, accumulated - steps * FRAME_MS);
      return steps;
    },
  };
}

export type StepResult = { hit: MeetingBrick | null; lost: boolean };

// One fixed physics tick. React owns UI state; this module owns ball motion.
export function stepGame(state: GameState, bricks: MeetingBrick[], now: number): StepResult {
  const result: StepResult = { hit: null, lost: false };
  if (state.ballFrozenUntil !== null && now < state.ballFrozenUntil) return result;
  state.ballFrozenUntil = null;
  state.paddleX = clampPaddle(state.paddleX);
  const previousX = state.ballX;
  const previousY = state.ballY;
  state.ballX += state.ballVX;
  state.ballY += state.ballVY;

  if (state.ballX < BALL_RADIUS) {
    state.ballX = BALL_RADIUS;
    state.ballVX = Math.abs(state.ballVX);
  } else if (state.ballX > CANVAS_WIDTH - BALL_RADIUS) {
    state.ballX = CANVAS_WIDTH - BALL_RADIUS;
    state.ballVX = -Math.abs(state.ballVX);
  }
  if (state.ballY < BALL_RADIUS) {
    state.ballY = BALL_RADIUS;
    state.ballVY = Math.abs(state.ballVY);
  }

  // Only a downward crossing of the paddle top can produce a bounce.
  if (state.ballVY > 0 && previousY + BALL_RADIUS <= PADDLE_Y &&
      state.ballY + BALL_RADIUS >= PADDLE_Y) {
    const fraction = (PADDLE_Y - BALL_RADIUS - previousY) / (state.ballY - previousY);
    const impactX = previousX + (state.ballX - previousX) * fraction;
    if (impactX + BALL_RADIUS >= state.paddleX - PADDLE_WIDTH / 2 &&
        impactX - BALL_RADIUS <= state.paddleX + PADDLE_WIDTH / 2) {
      state.ballY = PADDLE_Y - BALL_RADIUS;
      const speed = Math.min(MAX_SPEED, Math.hypot(state.ballVX, state.ballVY) || INITIAL_SPEED);
      // Limit glancing shots so the ball cannot become almost horizontal.
      const offset = clamp((impactX - state.paddleX) / (PADDLE_WIDTH / 2), -1, 1);
      const angle = offset * Math.PI / 3;
      state.ballVX = Math.sin(angle) * speed;
      state.ballVY = -Math.cos(angle) * speed;
    }
  }

  for (const brick of bricks) {
    if (!brick.active) continue;
    const dx = state.ballX - clamp(state.ballX, brick.x, brick.x + brick.width);
    const dy = state.ballY - clamp(state.ballY, brick.y, brick.y + brick.height);
    if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) continue;

    // Resolve against the entry face, not the nearest face after penetration.
    // Thin meetings can otherwise reflect the ball along the wrong axis.
    if (previousY <= brick.y - BALL_RADIUS && state.ballVY > 0) {
      state.ballY = brick.y - BALL_RADIUS;
      state.ballVY = -Math.abs(state.ballVY);
    } else if (previousY >= brick.y + brick.height + BALL_RADIUS && state.ballVY < 0) {
      state.ballY = brick.y + brick.height + BALL_RADIUS;
      state.ballVY = Math.abs(state.ballVY);
    } else if (previousX <= brick.x - BALL_RADIUS && state.ballVX > 0) {
      state.ballX = brick.x - BALL_RADIUS;
      state.ballVX = -Math.abs(state.ballVX);
    } else if (previousX >= brick.x + brick.width + BALL_RADIUS && state.ballVX < 0) {
      state.ballX = brick.x + brick.width + BALL_RADIUS;
      state.ballVX = Math.abs(state.ballVX);
    } else {
      const faces: Array<{ distance: number } & (
        { x: number; vx: number } | { y: number; vy: number }
      )> = [
        { distance: Math.abs(state.ballX - (brick.x - BALL_RADIUS)), x: brick.x - BALL_RADIUS, vx: -Math.abs(state.ballVX) },
        { distance: Math.abs(state.ballX - (brick.x + brick.width + BALL_RADIUS)), x: brick.x + brick.width + BALL_RADIUS, vx: Math.abs(state.ballVX) },
        { distance: Math.abs(state.ballY - (brick.y - BALL_RADIUS)), y: brick.y - BALL_RADIUS, vy: -Math.abs(state.ballVY) },
        { distance: Math.abs(state.ballY - (brick.y + brick.height + BALL_RADIUS)), y: brick.y + brick.height + BALL_RADIUS, vy: Math.abs(state.ballVY) },
      ];
      const face = faces.reduce((a, b) => a.distance < b.distance ? a : b);
      if ('x' in face) {
        state.ballX = face.x;
        state.ballVX = face.vx;
      } else {
        state.ballY = face.y;
        state.ballVY = face.vy;
      }
    }
    const speed = Math.hypot(state.ballVX, state.ballVY);
    if (speed > 0) {
      const factor = Math.min(MAX_SPEED, speed * HIT_SPEED_MULTIPLIER) / speed;
      state.ballVX *= factor;
      state.ballVY *= factor;
    }
    brick.active = false;
    result.hit = brick;
    break;
  }
  result.lost = state.ballY - BALL_RADIUS > CANVAS_HEIGHT;
  return result;
}
