import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeetingCalendar, MILAN_MEETING_TITLE } from '../lib/meetings.ts';
import { createGame, stepGame, BALL_RADIUS } from '../lib/game.ts';

test('every calendar reserves exactly two separated, visible, non-overlapping Milan meetings', () => {
  const originalRandom = Math.random;
  let seed = 123456789;
  const seeded = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  try {
    for (const random of [() => 0, () => 0.999999, seeded]) {
      Math.random = random;
      for (let round = 0; round < 100; round++) {
        const bricks = createMeetingCalendar();
        const protectedMeetings = bricks.filter(b => b.isMilan);
        assert.equal(protectedMeetings.length, 2);
        assert.equal(bricks.filter(b => b.title === MILAN_MEETING_TITLE).length, 2);
        assert.ok(Math.abs(protectedMeetings[0].x - protectedMeetings[1].x) >= 600);
        assert.ok(Math.abs(protectedMeetings[0].y - protectedMeetings[1].y) >= 200);
        assert.ok(bricks.some(b => !b.isMilan));
        assert.equal(new Set(bricks.map(b => b.id)).size, bricks.length);
        for (const brick of protectedMeetings) {
          assert.ok(brick.height >= 40, 'reserved meeting keeps its calendar height');
          assert.ok(brick.active && brick.x >= 56 && brick.x + brick.width <= 840);
          assert.ok(brick.y >= 56 && brick.y + brick.height <= 488);
          for (const other of bricks) {
            if (other === brick) continue;
            assert.ok(brick.x + brick.width <= other.x || brick.x >= other.x + other.width ||
              brick.y + brick.height <= other.y || brick.y >= other.y + other.height);
          }
        }
      }
    }
  } finally { Math.random = originalRandom; }
});

test('hitting either Milan meeting ends the round without canceling it or increasing speed', () => {
  const bricks = createMeetingCalendar();
  for (const meeting of bricks.filter(b => b.isMilan)) {
    const ball = {...createGame(0,0), ballX:meeting.x + meeting.width / 2,
      ballY:meeting.y + meeting.height + BALL_RADIUS + 2, ballVX:0,ballVY:-3};
    const result = stepGame(ball, bricks, 0);
    assert.equal(result.lost, true);
    assert.equal(result.hit, meeting);
    assert.equal(meeting.active, true);
    assert.equal(ball.ballVY, -3);
  }
});
