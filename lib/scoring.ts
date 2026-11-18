// Scoring, out of 100 per round: peak timing 40, shape 45 (five two-year slices x 9), ending 15.
// Pure functions so the server can score a guess the same way everywhere.
import { MONTHS, QUARTERS } from "./constants.ts";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type Slice = { real: number; you: number; off: number; points: number };
export type RoundScore = {
  total: number;
  peak: number;
  shape: number;
  end: number;
  peakOff: number; // months between your peak and the nearest real peak
  yourPeak: number; // month index
  realPeak: number; // the real peak nearest to yours
  slices: Slice[];
  realEnd: number;
  yourEnd: number;
};

/** Months whose value is 92+ and a local high. Seasonal topics have several; any of them counts. */
export function peakMonths(data: number[]): number[] {
  const out: number[] = [];
  for (let m = 0; m < data.length; m++) {
    const v = data[m];
    if (v >= 92 && (m === 0 || v >= data[m - 1]) && (m === data.length - 1 || v >= data[m + 1])) out.push(m);
  }
  if (!out.length) out.push(data.indexOf(Math.max(...data)));
  return out;
}

/** Points that fade from full (within 10) to zero (40 off). */
const tolerance = (off: number) => clamp(1 - (off - 10) / 30, 0, 1);

export function scoreRound(data: number[], guess: number[], yourPeak: number): RoundScore {
  if (data.length !== MONTHS || guess.length !== QUARTERS) throw new Error("bad lengths");
  const peaks = peakMonths(data);
  const realPeak = peaks.reduce((b, m) => (Math.abs(m - yourPeak) < Math.abs(b - yourPeak) ? m : b), peaks[0]);
  const peakOff = Math.abs(realPeak - yourPeak);
  // Full marks within 3 months, zero at about 3 years off.
  const peak = peakOff <= 3 ? 40 : Math.max(0, 40 * (1 - (peakOff - 3) / 33));

  const slices: Slice[] = [];
  for (let s = 0; s < 5; s++) {
    let r = 0, u = 0;
    for (let m = 24 * s; m < 24 * s + 24; m++) r += data[m];
    for (let q = 8 * s; q < 8 * s + 8; q++) u += guess[q];
    r /= 24; u /= 8;
    const off = Math.abs(r - u);
    slices.push({ real: r, you: u, off, points: 9 * tolerance(off) });
  }
  const shape = slices.reduce((t, s) => t + s.points, 0);

  let realEnd = 0, yourEnd = 0;
  for (let m = 108; m < 120; m++) realEnd += data[m];
  for (let q = 36; q < 40; q++) yourEnd += guess[q];
  realEnd /= 12; yourEnd /= 4;
  const end = 15 * tolerance(Math.abs(realEnd - yourEnd));

  return { total: Math.round(peak + shape + end), peak, shape, end, peakOff, yourPeak, realPeak, slices, realEnd, yourEnd };
}

/** Freehand lines are rescaled so their highest point is 100; the peak is the highest quarter. */
export function normalizeFreehand(guess: number[]): { vals: number[]; peakMonth: number } {
  const mx = Math.max(...guess);
  const vals = guess.map((v) => (mx > 0.5 ? (v / mx) * 100 : 50));
  const qi = vals.indexOf(Math.max(...vals));
  return { vals, peakMonth: 3 * qi + 1 };
}

export function rankWord(total: number): { word: string; tone: "good" | "mid" | "bad" } {
  if (total >= 95) return { word: "Called it", tone: "good" };
  if (total >= 80) return { word: "Trend spotter", tone: "good" };
  if (total >= 60) return { word: "Ahead of the curve", tone: "good" };
  if (total >= 40) return { word: "Late to the party", tone: "mid" };
  return { word: "Missed the boat", tone: "bad" };
}
