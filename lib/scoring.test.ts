// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeholderSource } from "./curves/placeholder.ts";
import { scoreRound, normalizeFreehand, peakMonths } from "./scoring.ts";

const quarterly = (d: number[]) => Array.from({ length: 40 }, (_, q) => (d[3 * q] + d[3 * q + 1] + d[3 * q + 2]) / 3);

test("all five placeholder curves are 120 months with a max of 100", async () => {
  const topics = await placeholderSource.getDay("2026-12-01");
  assert.equal(topics.length, 5);
  for (const t of topics) {
    assert.equal(t.data.length, 120);
    assert.equal(Math.max(...t.data), 100);
  }
});

test("tracing the real line scores 95+ on every topic", async () => {
  for (const t of await placeholderSource.getDay("2026-12-01")) {
    const s = scoreRound(t.data, quarterly(t.data), peakMonths(t.data)[0]);
    assert.ok(s.total >= 95, `${t.name}: ${s.total}`);
  }
});

test("a flat line scores low (target about 25)", async () => {
  const totals = [];
  for (const t of await placeholderSource.getDay("2026-12-01")) {
    const { vals, peakMonth } = normalizeFreehand(new Array(40).fill(50));
    totals.push(scoreRound(t.data, vals, peakMonth).total);
  }
  const avg = totals.reduce((a, b) => a + b) / totals.length;
  assert.ok(avg < 45, `avg ${avg}`);
});

test("seasonal topics accept any tall peak", async () => {
  const t = (await placeholderSource.getDay("2026-12-01"))[2];
  assert.ok(peakMonths(t.data).length > 1);
});
