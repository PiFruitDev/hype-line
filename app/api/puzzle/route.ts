// GET /api/puzzle?day=YYYY-MM-DD -> today's five topics, without the answers.
import { curveSource, toPublic } from "@/lib/curves/index.ts";
import { isValidDay, puzzleNumber } from "@/lib/day.ts";

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day");
  if (!isValidDay(day)) return Response.json({ error: "bad day" }, { status: 400 });
  const topics = await curveSource().getDay(day);
  return Response.json({ day, number: puzzleNumber(day), topics: topics.map(toPublic) });
}
