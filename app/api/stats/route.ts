// GET /api/stats?day=YYYY-MM-DD -> your streak and how you did against everyone, once you've played all 5 rounds.
import { isValidDay } from "@/lib/day.ts";
import { dayStats, hasDb } from "@/lib/db.ts";
import { playerId } from "@/lib/player.ts";

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day");
  if (!isValidDay(day)) return Response.json({ error: "bad day" }, { status: 400 });
  if (!hasDb()) return Response.json({ stats: null });
  try {
    return Response.json({ stats: await dayStats(await playerId(), day) });
  } catch (e) {
    console.error("db error", e);
    return Response.json({ stats: null });
  }
}
