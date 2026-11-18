// The data layer. Everything else in the app only talks to a CurveSource,
// so placeholder curves can be swapped for real stored data without touching the game.

export type TopicRole = "Warm-up" | "Slow climb" | "Seasonal" | "Curveball" | "Showpiece";

export type Topic = {
  id: string; // stable slug, e.g. "fidget-spinner"
  name: string; // shown big on the card
  clue: string; // one-line hint under the name
  role: TopicRole;
  fact: string; // the "Why" line shown after the reveal
  data: number[]; // 120 monthly values, Jan 2016 to Dec 2025, highest month = 100
};

/** What the browser gets before guessing: no curve data. */
export type PublicTopic = Omit<Topic, "data">;

export interface CurveSource {
  /** The five topics for a day (YYYY-MM-DD), in play order. */
  getDay(day: string): Promise<Topic[]>;
}
