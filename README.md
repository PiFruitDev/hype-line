# Hype Line

A daily web game. Each day you get five topics and guess how much the world searched each one from 2016 to 2025. Then the real line races over yours and you're scored out of 100 per round (500 per day).

Built with Next.js (App Router), hosted on Cloudflare Workers, with Postgres. Players are anonymous: no sign-up, just a cookie.

## Run it on your computer

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The game works without a database; it just won't save scores, show the crowd line, or track streaks.

To turn those on, copy `.env.example` to `.env.local`, paste your Postgres connection string into `DATABASE_URL`, and run `npm run db:setup` once.

The game's name is set in one place, `lib/site.ts`. The Cloudflare Worker name is `name` in `wrangler.jsonc` (it also sets the free `<name>.<your-account>.workers.dev` address).

Other commands: `npm test` (scoring tests), `npm run typecheck`, `npm run build`.

## Deploy (Cloudflare Workers)

The site runs on Cloudflare Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare). Cloudflare builds and deploys it from GitHub on every push.

1. In the Cloudflare dashboard go to **Workers & Pages > Create > Import a repository**, pick this repo, and use:
   - Project name: `hype-line` (must match `name` in `wrangler.jsonc`)
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Under advanced settings, turn on **builds for non-production branches** and set the non-production deploy command to `npx opennextjs-cloudflare upload`. Every other branch then gets its own preview URL.
2. Create a free Postgres database on [Neon](https://neon.tech) (or Supabase) and copy its connection string.
3. In the Worker's **Settings > Variables and Secrets**, add `DATABASE_URL` as a secret, then redeploy.
4. On your computer, put the same `DATABASE_URL` in `.env.local` and run `npm run db:setup` once to create the table.

To deploy from your computer instead: `npx wrangler login`, then `npm run deploy`. To try the real Workers runtime locally: copy `.dev.vars.example` to `.dev.vars` and run `npm run preview`.

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
| `wrangler.jsonc`, `open-next.config.ts` | Cloudflare Workers config. |
| `lib/day.ts` | Puzzle dates (player's local date) and the puzzle number. Set `LAUNCH_DAY` when you launch. |

### Swapping in real curve data

The curves are placeholders drawn from memory, not real Google Trends data, and every day serves the same five topics. To use real data, write a new `CurveSource` (for example one that reads `data/puzzles/YYYY-MM-DD.json` or a `puzzles` table) whose `getDay(day)` returns five topics with 120 monthly values each (Jan 2016 to Dec 2025, highest month = 100), and return it from `curveSource()` in `lib/curves/index.ts`. Nothing else needs to change.

### Notes

- The real curve never reaches the browser until you lock in, so it can't be peeked at.
- Only the first guess per player, day and round is saved, so replays don't change stats.
- The crowd line appears once 3 or more players have played a round.
