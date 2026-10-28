import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createFrameClock, stepGame, clampPaddle, CANVAS_WIDTH,
  CANVAS_HEIGHT, PADDLE_Y, BALL_RADIUS, MAX_SPEED } from '../lib/game.ts';

const state = (overrides = {}) => ({ ...createGame(0, 0), ballX: 420,
  ballY: 400, ballVX: 0, ballVY: -2.4, ballFrozenUntil: null, ...overrides });
const brick = (overrides = {}) => ({ id: 0, x: 100, y: 100, width: 100,
  height: 9, title: 'Standup', active: true, ...overrides });

for (const hz of [30, 60, 120, 144]) {
  test('60 physics ticks per second on a ' + hz + ' Hz display', () => {
    const clock = createFrameClock();
    let steps = 0;
    for (let frame = 0; frame <= hz; frame++) steps += clock.advance(frame * 1000 / hz);
    assert.equal(steps, 60);
  });
}

test('background gaps and a reset never fast-forward the ball', () => {
  const clock = createFrameClock();
  clock.advance(0);
  assert.equal(clock.advance(5000), 0);
  assert.equal(clock.advance(5000 + 1000 / 60), 1);
  clock.reset();
  assert.equal(clock.advance(10000), 0);
});

test('launch delay keeps the ball still until its deadline', () => {
  const ball = state({ ballFrozenUntil: 3000 });
  stepGame(ball, [], 2999);
  assert.equal(ball.ballY, 400);
  stepGame(ball, [], 3000);
  assert.equal(ball.ballY, 397.6);
  assert.equal(ball.ballFrozenUntil, null);
});

test('paddle stays entirely on the board', () => {
  assert.equal(clampPaddle(-200), 70);
  assert.equal(clampPaddle(1000), CANVAS_WIDTH - 70);
});

test('walls resolve penetration and reflect toward the board', () => {
  const ball = state({ ballX: 9, ballY: 9, ballVX: -5, ballVY: -5 });
  stepGame(ball, [], 0);
  assert.equal(ball.ballX, BALL_RADIUS);
  assert.equal(ball.ballY, BALL_RADIUS);
  assert.equal(ball.ballVX, 5);
  assert.equal(ball.ballVY, 5);
});

test('center paddle bounce preserves speed and travels upward', () => {
  const ball = state({ ballY: PADDLE_Y - BALL_RADIUS - 2, ballVY: 4 });
  stepGame(ball, [], 0);
  assert.equal(ball.ballY, PADDLE_Y - BALL_RADIUS);
  assert.equal(ball.ballVX, 0);
  assert.equal(ball.ballVY, -4);
});

test('paddle edge catches the ball radius and cannot create a horizontal shot', () => {
  const ball = state({ ballX: 495, ballY: PADDLE_Y - BALL_RADIUS - 2, ballVY: 9 });
  stepGame(ball, [], 0);
  assert.ok(ball.ballVY < -4);
  assert.ok(Math.abs(Math.hypot(ball.ballVX, ball.ballVY) - 9) < 1e-9);
});

test('moving the paddle under an already missed ball does not rescue it', () => {
  const ball = state({ ballY: PADDLE_Y + 2, ballVY: 4 });
  stepGame(ball, [], 0);
  assert.equal(ball.ballVY, 4);
});

test('thin meeting hit near a side reflects from the entry face', () => {
  const meeting = brick();
  const ball = state({ ballX: 101, ballY: 126, ballVY: -9 });
  const result = stepGame(ball, [meeting], 0);
  assert.equal(result.hit, meeting);
  assert.equal(meeting.active, false);
  assert.ok(ball.ballVY > 0);
  assert.equal(ball.ballY, 117);
  assert.ok(Math.hypot(ball.ballVX, ball.ballVY) <= MAX_SPEED);
  assert.equal(stepGame(ball, [meeting], 0).hit, null);
});

test('side hits reflect horizontally and separate the ball from the meeting', () => {
  const meeting = brick({height: 50});
  const ball = state({ ballX: 87, ballY: 125, ballVX: 7, ballVY: 0 });
  assert.equal(stepGame(ball, [meeting], 0).hit, meeting);
  assert.ok(ball.ballVX < 0);
  assert.equal(ball.ballX, 92);
});

test('circle outside a brick corner does not count as a hit', () => {
  const meeting = brick();
  const ball = state({ ballX: 93, ballY: 93, ballVX: 0, ballVY: 0 });
  assert.equal(stepGame(ball, [meeting], 0).hit, null);
  assert.equal(meeting.active, true);
});

test('one physics tick removes at most one meeting', () => {
  const meetings = [brick(), brick({id: 1})];
  const ball = state({ ballX: 150, ballY: 126, ballVY: -9 });
  stepGame(ball, meetings, 0);
  assert.equal(meetings.filter(b => b.active).length, 1);
});

test('ball below the board produces game over', () => {
  const ball = state({ ballY: CANVAS_HEIGHT + BALL_RADIUS, ballVY: 4 });
  assert.equal(stepGame(ball, [], 0).lost, true);
});
