# Hype Line

A daily web game. Each day you get five topics and guess how much the world searched each one from 2016 to 2025. Then the real line races over yours and you're scored out of 100 per round (500 per day).

Built with Next.js (App Router) and Postgres. Players are anonymous: no sign-up, just a cookie.

## Run it on your computer

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The game works without a database; it just won't save scores, show the crowd line, or track streaks.

To turn those on, copy `.env.example` to `.env.local`, paste your Postgres connection string into `DATABASE_URL`, and run `npm run db:setup` once.

Other commands: `npm test` (scoring tests), `npm run typecheck`, `npm run build`.

## Deploy

1. Import this repo on [Vercel](https://vercel.com/new). No settings to change.
2. Create a free Postgres database on [Neon](https://neon.tech) (or Supabase) and copy its connection string.
3. In Vercel, add it as the `DATABASE_URL` environment variable, then redeploy.
4. On your computer, run `npm run db:setup` with that same `DATABASE_URL` in `.env.local` to create the table.

## How the code is laid out

| Where | What |
| --- | --- |
| `components/Game.tsx` | The page markup (ids the game attaches to). |
| `lib/game/engine.ts` | The game itself: chart drawing, peak-first and freehand input, reveal animation, results, share text. Ported from the prototype. |
| `lib/scoring.ts` | Scoring: peak timing 40, shape 45 (five two-year slices), ending 15. Rank words. |
| `lib/curves/` | **The data layer.** `types.ts` defines a `CurveSource`; `placeholder.ts` holds the five test curves; `index.ts` picks the source. |
| `app/api/puzzle` | Today's five topics, without the answers. |
| `app/api/reveal` | Scores a locked-in guess on the server, saves it, returns the real curve and the crowd average line. |
| `app/api/stats` | Your streak and the share of players you beat, after all five rounds. |
| `lib/db.ts`, `db/schema.sql` | Postgres. One `guesses` table; totals, crowd lines and streaks are computed from it. |
| `lib/day.ts` | Puzzle dates (player's local date) and the puzzle number. Set `LAUNCH_DAY` when you launch. |

### Swapping in real curve data

The curves are placeholders drawn from memory, not real Google Trends data, and every day serves the same five topics. To use real data, write a new `CurveSource` (for example one that reads `data/puzzles/YYYY-MM-DD.json` or a `puzzles` table) whose `getDay(day)` returns five topics with 120 monthly values each (Jan 2016 to Dec 2025, highest month = 100), and return it from `curveSource()` in `lib/curves/index.ts`. Nothing else needs to change.

### Notes

- The real curve never reaches the browser until you lock in, so it can't be peeked at.
- Only the first guess per player, day and round is saved, so replays don't change stats.
- The crowd line appears once 3 or more players have played a round.
