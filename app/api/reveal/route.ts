// POST /api/reveal  { day, round, mode, vals[40], peakMonth }
// Scores the locked-in guess on the server, saves it, and returns the real curve plus the crowd line.
import { QUARTERS, MONTHS, ROUNDS } from "@/lib/constants.ts";
import { curveSource } from "@/lib/curves/index.ts";
import { isValidDay } from "@/lib/day.ts";
import { crowdLine, saveGuess } from "@/lib/db.ts";
import { playerId } from "@/lib/player.ts";
import { normalizeFreehand, scoreRound } from "@/lib/scoring.ts";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { day, round, mode } = body ?? {};
  let vals: unknown = body?.vals;
  let peakMonth: unknown = body?.peakMonth;

  const ok =
    isValidDay(day) &&
    Number.isInteger(round) && round >= 0 && round < ROUNDS &&
    (mode === "peak" || mode === "free") &&
    Array.isArray(vals) && vals.length === QUARTERS && vals.every((v) => typeof v === "number" && Number.isFinite(v));
  if (!ok) return Response.json({ error: "bad guess" }, { status: 400 });

  let guess = (vals as number[]).map((v) => Math.max(0, Math.min(100, v)));
  let peak: number;
  if (mode === "free") {
    const n = normalizeFreehand(guess);
    guess = n.vals;
    peak = n.peakMonth;
  } else {
    if (!Number.isInteger(peakMonth) || (peakMonth as number) < 0 || (peakMonth as number) >= MONTHS)
      return Response.json({ error: "bad peak" }, { status: 400 });
    peak = peakMonth as number;
  }

  const topic = (await curveSource().getDay(day))[round];
  const score = scoreRound(topic.data, guess, peak);

  let crowd: Awaited<ReturnType<typeof crowdLine>> = null;
  try {
    const pid = await playerId();
    await saveGuess({ playerId: pid, day, round, topicId: topic.id, mode, vals: guess, peakMonth: peak, score: score.total });
    crowd = await crowdLine(day, round);
  } catch (e) {
    console.error("db error", e); // the game keeps working if the database is down
  }

  return Response.json({ data: topic.data, fact: topic.fact, score, crowd });
}
