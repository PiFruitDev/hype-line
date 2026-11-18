// Pick the curve source here. To use real data later, write another CurveSource
// (for example one that reads data/puzzles/2026-12-01.json or a "puzzles" table) and return it below.
import { placeholderSource } from "./placeholder.ts";
import type { CurveSource, PublicTopic, Topic } from "./types.ts";

export type { Topic, PublicTopic, CurveSource };

export function curveSource(): CurveSource {
  return placeholderSource;
}

export const toPublic = ({ data: _data, ...rest }: Topic): PublicTopic => rest;
