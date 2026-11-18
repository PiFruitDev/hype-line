// Placeholder curves: rough shapes drawn from memory to test the feel.
// They are NOT real Google Trends data. Every day serves the same five topics.
import { MONTHS } from "../constants.ts";
import type { CurveSource, Topic } from "./types.ts";

const g = (x: number, c: number, s: number) => Math.exp(-((x - c) ** 2) / (2 * s * s));
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const gen = (f: (m: number) => number) => {
  const a = Array.from({ length: MONTHS }, (_, m) => Math.max(0.3, f(m)));
  const mx = Math.max(...a);
  return a.map((v) => Math.round((v / mx) * 1000) / 10);
};

const TOPICS: Topic[] = [
  {
    id: "fidget-spinner", name: "Fidget spinner", clue: "the 2017 spinning toy", role: "Warm-up",
    fact: "The craze peaked in spring 2017 and faded within months, as schools started banning the toys.",
    data: gen((m) => 1.5 + (m <= 16 ? 100 * g(m, 16, 1.3) : 98 * Math.exp(-(m - 16) / 2.6) + 4 * Math.exp(-(m - 16) / 30))),
  },
  {
    id: "air-fryer", name: "Air fryer", clue: "the countertop gadget", role: "Slow climb",
    fact: "A steady climb through the pandemic years, with a jump every December when people shop for gifts.",
    data: gen((m) => {
      const t = 8 + 62 * sig((m - 55) / 10) - 10 * Math.max(0, (m - 83) / 36);
      return t + (t / 70) * (25 * g(m % 12, 11, 0.8) + 10 * g(m % 12, 10, 0.8));
    }),
  },
  {
    id: "pumpkin-spice", name: "Pumpkin spice", clue: "the autumn flavor", role: "Seasonal",
    fact: "Every year it surges in September and October, then nearly vanishes. Any of the tallest autumn peaks counts as the peak.",
    data: gen((m) => {
      const amp = 95 - 3 * Math.floor(m / 12);
      const d = (m % 12) - 8.6;
      return 5 + amp * Math.exp(-(d * d) / 2);
    }),
  },
  {
    id: "zoom", name: "Zoom", clue: "the video call app", role: "Curveball",
    fact: "Lockdowns in March 2020 sent searches through the roof, and they never fell back to where they started.",
    data: gen((m) => (m < 49 ? 3 + 0.04 * m : m === 49 ? 8 : m === 50 ? 70 : m === 51 ? 100 : 18 + 14 * Math.exp(-(m - 51) / 25) + 68 * Math.exp(-(m - 51) / 4))),
  },
  {
    id: "pickleball", name: "Pickleball", clue: "the paddle sport", role: "Showpiece",
    fact: "Quiet for years, then a steady boom from about 2021, with a bump every summer.",
    data: gen((m) => (2 + 80 * sig((m - 72) / 9)) * (1 + 0.18 * Math.cos((2 * Math.PI * ((m % 12) - 6.5)) / 12))),
  },
];

export const placeholderSource: CurveSource = {
  async getDay() {
    return TOPICS;
  },
};
