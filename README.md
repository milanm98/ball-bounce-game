# Cancel All Meetings

A desktop canvas arcade game: bounce the ball with the paddle to clear a calendar of meetings.

## Local development

Use Node.js 24 LTS (Node.js 22.13+ on the 22.x line is also supported).

~~~sh
npm ci
npm run dev -- --hostname 127.0.0.1
~~~

Open [the local game](http://127.0.0.1:3000). A viewport at least 1024 CSS pixels wide is required. Enter a name and start; move the mouse over the canvas or use the left/right arrow keys. The ball launches after three seconds. Missing the paddle returns to the intro; clearing the board enables New day.

## Checks

~~~sh
npm test
npm run lint
npm run typecheck
npm run build
npm audit
~~~

The tests cover physics at 30/60/120/144 Hz, launch timing, wall/meeting/paddle collisions, speed limits, and game over. React integration tests use jsdom with a mocked canvas and animation clock to check the live counter, controls, loss/restart, win/New day, and timer/frame cleanup under Strict Mode. They do not verify browser rendering.

To run the production build locally:

~~~sh
npm run build
npm start -- --hostname 127.0.0.1
~~~

Development and production builds use Next.js's supported webpack compiler because Turbopack's CSS worker crashes on this Windows environment. Fonts use the existing system stack, so builds do not download fonts.

## Manual regression checks

- Confirm blank and whitespace-only names cannot start a round.
- Check the launch delay, mouse and arrow controls, and paddle bounds.
- Hit meetings and confirm the canvas counter decreases; miss the paddle and start again.
- Clear a calendar and use New day; confirm no old toast carries into the new round.
- Switch tabs and return; the ball should not fast-forward across the board.
- Resize to a short desktop viewport; the complete board should remain visible. Below 1024 pixels wide, the existing desktop-only notice should appear.

## Browser QA

The desktop layout fixes and verification results are recorded in [the 2026-10-28 QA report](qa/2026-10-28/README.md), including viewport measurements, screenshots, and a short frame-timing sample.

## Milan meetings

Every calendar reserves exactly two **talk with Milan about memes** meetings at opposite ends of the week, one early and one late in the day. They use the same colors, borders, and text styling as other meetings. Read the titles and avoid both: hitting either immediately ends the round and opens the Milan game-over popup. Try again starts a fresh calendar. Cancel all ordinary meetings to win; the counter excludes the two protected Milan meetings.

Meeting titles wrap in full across multiple lines, including Milan’s meetings. Every box has a minimum height for three lines in the same regular font; meeting names are never replaced with ellipses.

## Public metadata and sharing

Production URL, page title, description, Open Graph/Twitter cards, and VideoGame structured data are defined in `lib/site.ts`. The calendar/ball favicon is `app/icon.svg`, with matching ICO and Apple touch icons. The 1200×630 sharing card is `public/social-preview.png`; its editable SVG source is alongside it. `app/robots.ts` and `app/sitemap.ts` expose crawler discovery routes. Update the production URL in `lib/site.ts` if the domain changes.
