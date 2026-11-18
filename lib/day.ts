// Days are the player's local calendar date (YYYY-MM-DD), so the puzzle resets at their midnight.
// The server accepts any date within a day of UTC "today", which covers every time zone.
export const LAUNCH_DAY = "2026-12-01"; // puzzle #1; change when you launch

const DAY_MS = 86_400_000;
const toUTC = (day: string) => Date.parse(day + "T00:00:00Z");

export function isValidDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = toUTC(day);
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now - 2 * DAY_MS && t <= now + DAY_MS;
}

export function puzzleNumber(day: string): number {
  return Math.max(1, Math.round((toUTC(day) - toUTC(LAUNCH_DAY)) / DAY_MS) + 1); // test days before launch show #1
}

export function prevDay(day: string): string {
  return new Date(toUTC(day) - DAY_MS).toISOString().slice(0, 10);
}
