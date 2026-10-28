import { CANVAS_HEIGHT, CANVAS_WIDTH, type MeetingBrick } from './game.ts';

export const SLOTS_PER_DAY = 24;
export const MILAN_MEETING_TITLE = 'talk with Milan about memes';
export const MILAN_GAME_OVER_MESSAGE =
  'You really wanted to cancel meet with Milan? Its game over now. try again.';

const MEETING_TITLES = [
  'Daily Standup', 'Sprint Planning', 'Sprint Retrospective', 'Code Review',
  'Project Sync', 'Technical Debt Review', 'Product Planning', 'Cross-Team Sync',
  'Roadmap Review', 'Incident Postmortem', 'Quarterly All-Hands', 'Stakeholder Sync',
  'Backlog Refinement', 'Architecture Review', 'QA Test Planning', 'Design Handoff',
  'Sprint Review', 'Team Planning', 'Release Planning', 'Customer Feedback',
];

export function createMeetingCalendar(): MeetingBrick[] {
  const gridTop = 56;
  const leftGutter = 56;
  const gridHeight = CANVAS_HEIGHT - 32 - 40 - gridTop;
  const colWidth = (CANVAS_WIDTH - leftGutter) / 7;
  const slotHeight = gridHeight / SLOTS_PER_DAY;
  const bricks: MeetingBrick[] = [];

  function meeting(day: number, start: number, duration: number, title: string, isMilan = false): MeetingBrick {
    return {
      id: bricks.length,
      x: leftGutter + day * colWidth + 6,
      y: gridTop + start * slotHeight + 2,
      width: colWidth - 12,
      height: duration * slotHeight - 4,
      title,
      active: true,
      isMilan,
    };
  }

  // Reserve both protected meetings first, so random placement can never omit
  // them. Opposite ends of the week and day keep them well separated.
  const earlyDay = randomInt(0, 1) === 0 ? 0 : 6;
  bricks.push(meeting(earlyDay, randomInt(0, 2), 3, MILAN_MEETING_TITLE, true));
  bricks.push(meeting(6 - earlyDay, randomInt(14, 15), 3, MILAN_MEETING_TITLE, true));

  for (let day = 0; day < 7; day++) {
    const count = randomInt(2, 5);
    let created = 0;
    for (let attempt = 0; created < count && attempt < 25; attempt++) {
      const start = randomInt(0, 12);
      const duration = randomInt(1, 6);
      const title = MEETING_TITLES[(bricks.length + day + start) % MEETING_TITLES.length];
      const candidate = meeting(day, start, duration, title);
      if (bricks.some(b => candidate.x < b.x + b.width && candidate.x + candidate.width > b.x &&
        candidate.y < b.y + b.height && candidate.y + candidate.height > b.y)) continue;
      bricks.push(candidate);
      created++;
    }
  }
  return bricks;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
