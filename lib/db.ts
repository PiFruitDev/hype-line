// Postgres access (Neon or Supabase both work: just set DATABASE_URL).
// Without DATABASE_URL the game still runs; it just doesn't save scores, crowd lines or streaks.
import postgres from "postgres";
import { QUARTERS } from "./constants.ts";
import { prevDay } from "./day.ts";

type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { _sql?: Sql };

function db(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Reuse one small pool per server instance. prepare:false keeps it compatible with poolers (Neon/Supabase).
  globalForDb._sql ??= postgres(url, { max: 3, prepare: false, idle_timeout: 20 });
  return globalForDb._sql;
}

export const hasDb = () => !!process.env.DATABASE_URL;

export async function saveGuess(g: {
  playerId: string; day: string; round: number; topicId: string;
  mode: "peak" | "free"; vals: number[]; peakMonth: number; score: number;
}): Promise<void> {
  const sql = db();
  if (!sql) return;
  await sql`
    insert into guesses (player_id, day, round, topic_id, mode, vals, peak_month, score)
    values (${g.playerId}, ${g.day}, ${g.round}, ${g.topicId}, ${g.mode}, ${g.vals}, ${g.peakMonth}, ${g.score})
    on conflict do nothing`;
}

/** The average of everyone's guesses for a round, or null if too few players yet. */
export async function crowdLine(day: string, round: number, min = 3): Promise<{ line: number[]; n: number } | null> {
  const sql = db();
  if (!sql) return null;
  const rows = await sql<{ i: number; avg: number; n: number }[]>`
    select u.i::int as i, avg(u.v)::float8 as avg, count(*)::int as n
    from guesses, unnest(vals) with ordinality as u(v, i)
    where day = ${day} and round = ${round}
    group by u.i order by u.i`;
  if (rows.length !== QUARTERS || rows[0].n < min) return null;
  return { line: rows.map((r) => Math.round(r.avg * 10) / 10), n: rows[0].n };
}

export type DayStats = { total: number; players: number; beatPct: number; streak: number; maxStreak: number; played: number };

/** Stats for a player who has finished all 5 rounds of a day. */
export async function dayStats(playerId: string, day: string): Promise<DayStats | null> {
  const sql = db();
  if (!sql) return null;
  const totals = await sql<{ player_id: string; total: number }[]>`
    select player_id, sum(score)::int as total from guesses
    where day = ${day} group by player_id having count(*) = 5`;
  const mine = totals.find((t) => t.player_id === playerId);
  if (!mine) return null;
  const others = totals.length - 1;
  const beaten = totals.filter((t) => t.total < mine.total).length;

  const days = await sql<{ day: string }[]>`
    select to_char(day, 'YYYY-MM-DD') as day from guesses
    where player_id = ${playerId} group by day having count(*) = 5 order by day desc limit 1000`;
  const set = new Set(days.map((d) => d.day));
  let streak = 0;
  for (let d = day; set.has(d); d = prevDay(d)) streak++;
  let maxStreak = 0, run = 0, last = "";
  for (const d of [...set].sort()) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    last = d;
  }
  return {
    total: mine.total,
    players: totals.length,
    beatPct: others > 0 ? Math.round((beaten / others) * 100) : 100,
    streak, maxStreak, played: set.size,
  };
}
