// Postgres access (Neon or Supabase both work: just set DATABASE_URL).
// Without DATABASE_URL the game still runs; it just doesn't save scores, crowd lines or streaks.
import postgres from "postgres";
import { QUARTERS } from "./constants.ts";
import { prevDay } from "./day.ts";

type Sql = ReturnType<typeof postgres>;

/**
 * Runs fn with a fresh connection and closes it afterwards. On Cloudflare Workers a connection
 * can't be shared between requests, so we open one per request (cheap enough at this scale;
 * Cloudflare Hyperdrive can pool them later). Returns null when there's no DATABASE_URL.
 */
async function withDb<T>(fn: (sql: Sql) => Promise<T>): Promise<T | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // prepare:false keeps it compatible with connection poolers (Neon, Supabase, Hyperdrive).
  const sql = postgres(url, { max: 1, prepare: false, fetch_types: false, connect_timeout: 10 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

export const hasDb = () => !!process.env.DATABASE_URL;

/** Saves a guess (first one per player, day and round wins) and returns the crowd line for that round. */
export async function saveGuess(g: {
  playerId: string; day: string; round: number; topicId: string;
  mode: "peak" | "free"; vals: number[]; peakMonth: number; score: number;
}): Promise<{ line: number[]; n: number } | null> {
  return withDb(async (sql) => {
    await sql`
      insert into guesses (player_id, day, round, topic_id, mode, vals, peak_month, score)
      values (${g.playerId}, ${g.day}, ${g.round}, ${g.topicId}, ${g.mode}, ${g.vals}, ${g.peakMonth}, ${g.score})
      on conflict do nothing`;
    return crowdLine(sql, g.day, g.round);
  });
}

/** The average of everyone's guesses for a round, or null if too few players yet. */
async function crowdLine(sql: Sql, day: string, round: number, min = 3): Promise<{ line: number[]; n: number } | null> {
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
  return withDb((sql) => dayStatsWith(sql, playerId, day));
}

async function dayStatsWith(sql: Sql, playerId: string, day: string): Promise<DayStats | null> {
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
