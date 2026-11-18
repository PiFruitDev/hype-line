// The game screen, ported from the prototype (hype-line-prototype.html) with as few changes as possible.
// It draws the chart as SVG and handles touch/mouse input directly for a smooth feel.
// Differences from the prototype: topics come from /api/puzzle, the real curve and score come from
// /api/reveal after Lock in, progress is saved in localStorage per day, and the end screen shows stats.
import { MONTHS as N, QUARTERS as Q, ROUNDS, monthLabel as dt } from "../constants.ts";
import { rankWord, type RoundScore } from "../scoring.ts";
import type { PublicTopic } from "../curves/types.ts";

type Mode = "peak" | "free";
type Reveal = { data: number[]; fact: string; score: RoundScore; crowd: { line: number[]; n: number } | null };
type Saved = { round: number; topic: string; mode: Mode; vals: number[]; reveal: Reveal };
type Stats = { total: number; players: number; beatPct: number; streak: number; maxStreak: number; played: number } | null;

const W = 360, H = 250, PL = 14, PR = 14, PT = 30, PB = 36, YB = H - PB;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const X = (m: number) => PL + (m / (N - 1)) * (W - PL - PR);
const Y = (v: number) => PT + (1 - v / 100) * (YB - PT);
const invX = (sx: number) => clamp(((sx - PL) / (W - PL - PR)) * (N - 1), 0, N - 1);
const invY = (sy: number) => clamp((1 - (sy - PT) / (YB - PT)) * 100, 0, 100);
const g = (x: number, c: number, s: number) => Math.exp(-((x - c) ** 2) / (2 * s * s));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type State = {
  mode: Mode; phase: "peak" | "shape" | "draw"; vals: (number | null)[]; peakM: number | null;
  locked: boolean; revealM: number | null; done: boolean; final?: number[]; pending?: boolean;
  pen: { x: number; y: number; fy: number | null } | null; ghost: { x: number; y: number; down: boolean } | null;
  reveal?: Reveal; realQ?: number[];
};

export function mountGame(root: HTMLElement): () => void {
  const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;
  const svg = root.querySelector<SVGSVGElement>("#chart")!;
  const day = localDay();
  const KEY = `hypeline:${day}`;
  let topics: PublicTopic[] = [];
  let puzzleNo = 0;
  let mode: Mode = "peak", round = 0, results: Saved[] = [];
  let S: State;
  let drag: any = null, last: { q: number; v: number } | null = null, demo = false, skip = false, raf = 0;
  let alive = true, timer = 0;
  const ac = new AbortController(); // removes every listener on unmount
  const opt = { signal: ac.signal };

  try { const m = localStorage.getItem("hypeline:mode"); if (m === "free" || m === "peak") mode = m; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(results)); } catch {} };
  const load = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };

  const fresh = (): State => ({ mode, phase: mode === "peak" ? "peak" : "draw", vals: new Array(Q).fill(null), peakM: null, locked: false, revealM: null, done: false, pen: null, ghost: null });
  const pq = () => Math.floor(S.peakM! / 3);

  function filled() {
    const v = S.vals, idx: number[] = [];
    for (let i = 0; i < Q; i++) if (v[i] != null) idx.push(i);
    if (!idx.length) return null;
    const lo = idx[0], hi = idx[idx.length - 1], a = v.slice() as number[];
    for (let i = 0; i < Q; i++) {
      if (v[i] != null) continue;
      if (i < lo) a[i] = v[lo]!; else if (i > hi) a[i] = v[hi]!;
      else { let R = i + 1; while (v[R] == null) R++; const L = i - 1; a[i] = a[L] + (v[R]! - a[L]) / (R - L); }
    }
    return { a, lo, hi };
  }
  const defaultShape = (p: number) => Array.from({ length: Q }, (_, q) => (q === p ? 100 : 14 + 80 * g(q, p, 3.2)));
  function setPeak(m: number) { S.peakM = Math.round(clamp(m, 0, N - 1)); S.vals = defaultShape(pq()); }
  function movePeak(m: number) {
    if (S.phase === "peak") { setPeak(m); return; }
    const old = pq(); S.peakM = Math.round(clamp(m, 0, N - 1)); const np = pq();
    if (np !== old) { const l = S.vals[old - 1] ?? S.vals[old + 1]!, r = S.vals[old + 1] ?? S.vals[old - 1]!; S.vals[old] = Math.min(95, (l + r) / 2); }
    S.vals[np] = 100;
  }
  function setQ(q: number, v: number) { if (S.mode === "peak" && q === pq()) return; S.vals[q] = clamp(v, 0, 100); }
  function paintAt(m: number, v: number) {
    const q = Math.min(Q - 1, Math.floor(m / 3));
    if (last && last.q !== q) { const st = q > last.q ? 1 : -1; for (let k = last.q + st; k !== q; k += st) { const t = (k - last.q) / (q - last.q); setQ(k, last.v + (v - last.v) * t); } }
    setQ(q, v); last = { q, v };
  }
  function handleQs() { const p = pq(), out: number[] = []; for (let yr = 0; yr < 10; yr++) { let q = 4 * yr + 2; if (q === p) q = 4 * yr + 1; out.push(q); } return out; }
  function nudge(base: number[], q: number, dv: number) { const p = pq(); for (let j = 0; j < Q; j++) { if (j === p) continue; const w = Math.max(0, 1 - Math.abs(j - q) / 3); if (w > 0) S.vals[j] = clamp(base[j] + dv * w, 0, 100); } }

  function smooth(pts: number[][]) {
    if (pts.length < 2) return "";
    const cy = (y: number) => clamp(y, PT - 2, YB).toFixed(1);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${cy(p1[1] + (p2[1] - p0[1]) / 6)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${cy(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function tag(cx: number, y: number, text: string, cls = "") { const w = text.length * 5.6 + 10; const x = clamp(cx - w / 2, 2, W - w - 2); return `<g class="tag ${cls}"><rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="15" rx="4"/><text x="${(x + 5).toFixed(1)}" y="${y + 10.8}">${text}</text></g>`; }
  function userLine() {
    const f = S.final ? { a: S.final, lo: 0, hi: Q - 1 } : filled(); if (!f) return null;
    const pts: number[][] = [];
    for (let q = f.lo; q <= f.hi; q++) { let mx = 3 * q + 1; if (S.mode === "peak" && S.peakM != null && q === pq()) mx = S.peakM; pts.push([X(mx), Y(f.a[q])]); }
    if (pts.length === 1) pts.push([pts[0][0] + 0.1, pts[0][1]]);
    return smooth(pts);
  }

  function render() {
    let s = "";
    for (let k = 0; k <= 10; k++) { const xx = X(Math.min(12 * k, N - 1)); s += `<line class="g" x1="${xx}" y1="${PT}" x2="${xx}" y2="${YB}"/>`; }
    [25, 50, 75].forEach((v) => (s += `<line class="g" x1="${PL}" y1="${Y(v)}" x2="${W - PR}" y2="${Y(v)}"/>`));
    s += `<line class="base" x1="${PL}" y1="${YB}" x2="${W - PR}" y2="${YB}"/>`;
    s += `<line class="peakline" x1="${PL}" y1="${Y(100)}" x2="${W - PR}" y2="${Y(100)}"/>`;
    if (!(S.mode === "peak" && S.peakM != null) && !S.locked) s += `<text class="pk" x="${W - PR}" y="${Y(100) - 5}" text-anchor="end">PEAK HYPE · 100</text>`;
    for (let k = 0; k < 10; k++) s += `<text x="${X(12 * k + 5.5)}" y="${YB + 15}" text-anchor="middle">'${16 + k}</text>`;

    const empty = S.mode === "peak" ? S.peakM == null : !filled();
    if (empty && !S.locked) {
      if (S.mode === "peak") s += `<text class="htxt" x="${W / 2}" y="${Y(52)}" text-anchor="middle">Tap the month you think</text><text class="htxt" x="${W / 2}" y="${Y(52) + 16}" text-anchor="middle">searches peaked</text>`;
      else s += `<path class="hint" d="M${X(0)},${Y(8)} C${X(30)},${Y(10)} ${X(40)},${Y(70)} ${X(55)},${Y(72)} S${X(90)},${Y(25)} ${X(119)},${Y(22)}"/><text class="htxt" x="${W / 2}" y="${Y(46)}" text-anchor="middle">Draw from 2016 to 2025</text>`;
    }
    const R = S.reveal;
    if (S.locked && S.revealM != null && R && S.realQ) {
      const rm = S.revealM;
      for (let q = 0; q < Q; q++) {
        const mx = 3 * q + 1; if (mx > rm) break;
        const d = Math.abs(S.final![q] - S.realQ[q]); const c = d <= 12 ? "good" : d <= 25 ? "mid" : "bad";
        s += `<line class="band ${c}" x1="${X(mx)}" y1="${Y(S.final![q])}" x2="${X(mx)}" y2="${Y(S.realQ[q])}"/>`;
      }
    }
    if (S.done && R?.crowd) s += `<path class="crowd" d="${smooth(R.crowd.line.map((v, q) => [X(3 * q + 1), Y(v)]))}"/>`;
    const u = userLine();
    if (u) s += `<path class="user ${S.locked ? "locked" : ""}" d="${u}"/>`;
    if (S.locked && S.revealM != null && R) {
      const rm = S.revealM; let d = "";
      for (let m = 0; m <= Math.floor(rm); m++) d += (m ? "L" : "M") + X(m).toFixed(1) + "," + Y(R.data[m]).toFixed(1);
      s += `<path class="real" d="${d}"/>`;
      if (!S.done) s += `<line class="cur" x1="${X(rm)}" y1="${PT}" x2="${X(rm)}" y2="${YB}"/>` + tag(X(rm), PT - 22, dt(rm));
      else s += `<circle class="rpk" cx="${X(R.score.realPeak)}" cy="${Y(100)}" r="4.5"/>` + tag(X(R.score.realPeak), PT - 22, "Real peak: " + dt(R.score.realPeak), "acc");
    }
    if (!S.locked && S.mode === "peak" && S.peakM != null) {
      const px = X(S.peakM);
      s += `<line class="peakstem" x1="${px}" y1="${Y(100)}" x2="${px}" y2="${YB}"/>`;
      if (S.phase === "shape") handleQs().forEach((q) => { s += `<circle class="handle" cx="${X(3 * q + 1)}" cy="${Y(S.vals[q]!)}" r="6"/>`; });
      s += `<circle class="peakdot" cx="${px}" cy="${Y(100)}" r="8"/>` + tag(px, PT - 24, "Peak: " + dt(S.peakM), "acc");
    }
    if (S.pen && drag && drag.type === "paint") {
      if (S.pen.fy != null) s += `<line class="penlink" x1="${S.pen.x}" y1="${S.pen.y}" x2="${S.pen.x}" y2="${S.pen.fy}"/>`;
      s += `<circle class="pen" cx="${S.pen.x}" cy="${S.pen.y}" r="4.5"/>`;
      if (S.mode === "free") s += tag(S.pen.x, clamp(S.pen.y - 30, 2, YB), dt(invX(S.pen.x)));
    }
    if (S.ghost) s += `<circle class="ghost ${S.ghost.down ? "down" : ""}" cx="${S.ghost.x}" cy="${S.ghost.y}" r="13"/>`;
    svg.innerHTML = s;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  function canLock() { if (S.locked || S.pending) return false; if (S.mode === "peak") return S.peakM != null; const f = filled(); return !!f && f.lo <= 3 && f.hi >= 36; }
  function instr() {
    let step = "", txt = "";
    if (S.pending) txt = "Checking the real line…";
    else if (S.locked) txt = S.done ? "Here's how searches really moved." : "Here comes the real line. Tap the chart to skip.";
    else if (S.mode === "peak") {
      if (S.phase === "peak") { step = "Step 1 of 3"; txt = "Tap the month you think searches peaked."; }
      else { step = "Step 2 of 3"; txt = "Sweep across to shape the rest, then drag the dots to nudge. You can still slide the peak."; }
    } else { step = "Freehand"; txt = "Draw the line from 2016 to 2025. Go back over any part to fix it."; }
    if (demo) return;
    $("instr").innerHTML = (step ? `<span class="stp">${step}</span>` : "") + `<span>${txt}</span>`;
  }
  function ui() {
    $("m-peak").setAttribute("aria-checked", String(mode === "peak")); $("m-free").setAttribute("aria-checked", String(mode === "free"));
    ($("m-peak") as HTMLButtonElement).disabled = ($("m-free") as HTMLButtonElement).disabled = demo || S.locked || !!S.pending;
    ($("b-lock") as HTMLButtonElement).disabled = !canLock() || demo;
    ($("b-clear") as HTMLButtonElement).disabled = demo || S.locked || !!S.pending;
    $("b-demo").hidden = S.mode !== "peak";
    ($("b-demo") as HTMLButtonElement).disabled = demo || S.locked;
    $("actions").hidden = S.locked;
    instr();
  }
  function dots() { $("dots").innerHTML = Array.from({ length: ROUNDS }, (_, k) => `<b class="${k < round ? "done" : k === round ? "on" : ""}"></b>`).join(""); }
  function loadRound() {
    const T = topics[round]; S = fresh();
    $("t-k").textContent = `Round ${round + 1} of ${ROUNDS} · ${T.role}`; $("t-v").textContent = T.name; $("t-c").textContent = T.clue;
    $("result").hidden = true; $("legend").hidden = true; dots(); render(); ui();
  }

  function toSvg(e: PointerEvent) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM()!.inverse()); }
  function nearest(p: DOMPoint) {
    let best: any = null, bd = 18;
    if (S.peakM != null) { const d = Math.hypot(p.x - X(S.peakM), p.y - Y(100)); if (d < bd) { bd = d; best = { type: "peak" }; } }
    if (S.phase === "shape") handleQs().forEach((q) => { const d = Math.hypot(p.x - X(3 * q + 1), p.y - Y(S.vals[q]!)); if (d < bd) { bd = d; best = { type: "handle", q, base: S.vals.slice(), startY: p.y }; } });
    return best;
  }
  function onDown(e: PointerEvent) {
    if (demo || S.pending) return;
    if (S.locked) { if (!S.done) skip = true; return; }
    e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch {}
    const p = toSvg(e);
    if (S.mode === "peak" && S.phase === "peak") { drag = { type: "peak" }; setPeak(invX(p.x)); }
    else if (S.mode === "peak") drag = nearest(p) || { type: "paint" };
    else drag = { type: "paint" };
    if (drag.type === "paint") { last = null; drag.off = e.pointerType === "touch" ? 40 * (W / svg.getBoundingClientRect().width) : 0; }
    move(e);
  }
  function move(e: PointerEvent) {
    if (!drag) return; const p = toSvg(e);
    if (drag.type === "peak") movePeak(invX(p.x));
    else if (drag.type === "handle") nudge(drag.base, drag.q, invY(p.y) - invY(drag.startY));
    else { const py = p.y - drag.off; paintAt(invX(p.x), invY(py)); S.pen = { x: p.x, y: clamp(py, PT, YB), fy: drag.off ? p.y : null }; }
    schedule(); ui();
  }
  const onMove = (e: PointerEvent) => { if (drag) { e.preventDefault(); move(e); } };
  function up() { if (!drag) return; if (drag.type === "peak" && S.phase === "peak") S.phase = "shape"; drag = null; S.pen = null; last = null; render(); ui(); }

  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const quarterly = (d: number[]) => Array.from({ length: Q }, (_, q) => (d[3 * q] + d[3 * q + 1] + d[3 * q + 2]) / 3);

  async function lock() {
    if (!canLock()) return;
    const vals = S.mode === "peak" ? (S.vals as number[]).slice() : filled()!.a;
    const peakMonth = S.mode === "peak" ? S.peakM! : 0;
    S.pending = true; ui(); $("err").textContent = "";
    let reveal: Reveal;
    try {
      const r = await fetch("/api/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day, round, mode: S.mode, vals, peakMonth }) });
      if (!r.ok) throw new Error(String(r.status));
      reveal = await r.json();
    } catch {
      S.pending = false; ui(); $("err").textContent = "Couldn't reach the server. Check your connection and tap Lock in again.";
      return;
    }
    if (!alive) return;
    S.pending = false;
    // The server rescales freehand lines, so draw what was actually scored.
    S.final = S.mode === "free" ? normalized(vals) : vals;
    S.reveal = reveal; S.realQ = quarterly(reveal.data);
    S.locked = true; S.revealM = 0; ui();
    results[round] = { round, topic: topics[round].name, mode: S.mode, vals: S.final, reveal };
    save();
    const dur = reduce() ? 0 : 2400, t0 = performance.now(); skip = false;
    const f = (now: number) => {
      if (!alive) return;
      const t = dur && !skip ? Math.min(1, (now - t0) / dur) : 1;
      S.revealM = t * (N - 1); if (t >= 1) S.done = true; render();
      if (t < 1) requestAnimationFrame(f); else { ui(); showResult(true); }
    };
    f(t0);
  }
  const normalized = (a: number[]) => { const mx = Math.max(...a); return a.map((v) => (mx > 0.5 ? (v / mx) * 100 : 50)); };

  function sliceCls(sc: number) { return sc >= 7 ? "good" : sc >= 4 ? "mid" : "bad"; }
  function showResult(animate: boolean) {
    const R = S.reveal!.score, crowd = S.reveal!.crowd;
    const { word, tone } = rankWord(R.total); const st = $("r-word"); st.textContent = word; st.className = "stamp " + tone;
    const offTxt = R.peakOff <= 0 ? "spot on" : R.peakOff === 1 ? "1 month off" : `${R.peakOff} months off`;
    $("r-bd").innerHTML =
      `<div class="bdrow"><span class="l">Peak timing</span><span class="v">${Math.round(R.peak)}/40</span><span class="d">You: ${dt(R.yourPeak)} · Real: ${dt(R.realPeak)} · ${offTxt}</span></div>` +
      `<div class="bdrow"><span class="l">Shape, five two-year slices</span><span class="v">${Math.round(R.shape)}/45</span><span class="d"><span class="sq">${R.slices.map((s) => `<i class="${sliceCls(s.points)}" title="${Math.round(s.off)} points off"></i>`).join("")}</span>'16–'17 to '24–'25, green within 10 points</span></div>` +
      `<div class="bdrow"><span class="l">Where it ended</span><span class="v">${Math.round(R.end)}/15</span><span class="d">Final year: you ${Math.round(R.yourEnd)}, real ${Math.round(R.realEnd)}</span></div>`;
    $("r-fact").innerHTML = `<b>Why:</b> ${esc(S.reveal!.fact)}`;
    $("l-crowd").hidden = !crowd;
    if (crowd) $("l-crowd-n").textContent = `Everyone's average (${crowd.n.toLocaleString()} players)`;
    $("legend").hidden = false;
    $("b-next").textContent = round < ROUNDS - 1 ? "Next round" : "See results";
    $("result").hidden = false;
    const el = $("r-score"), t0 = performance.now();
    if (!animate || reduce()) { el.textContent = String(R.total); return; }
    const f = (now: number) => { const t = Math.min(1, (now - t0) / 700); el.textContent = String(Math.round(R.total * (1 - Math.pow(1 - t, 3)))); if (t < 1 && alive) requestAnimationFrame(f); };
    f(t0);
    $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function shareText(total: number) {
    const lines = results.map((r) => r.reveal.score.slices.map((s) => (s.points >= 7 ? "🟩" : s.points >= 4 ? "🟨" : "🟥")).join("") + (r.reveal.score.peak >= 36 ? " 🎯" : ""));
    return `Hype Line #${puzzleNo} · ${total}/500 📈\n${lines.join("\n")}\n${location.origin}`;
  }
  function countdown() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    if (localDay() !== day) { $("e-next").textContent = "A new puzzle is ready. Refresh to play."; return; }
    const s = Math.floor((+next - +now) / 1000);
    $("e-next").textContent = `Next puzzle in ${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  }
  async function showEnd() {
    $("play").hidden = true; $("end").hidden = false; root.querySelector<HTMLElement>(".seg")!.hidden = true; round = ROUNDS; dots();
    const total = results.reduce((t, r) => t + r.reveal.score.total, 0);
    $("e-total").textContent = String(total);
    $("e-rows").innerHTML = results.map((r) => `<div class="row"><span>${esc(r.topic)}</span><span class="m">${r.mode === "peak" ? "peak first" : "freehand"}</span><span class="s">${r.reveal.score.total}</span></div>`).join("");
    $("e-share").textContent = shareText(total);
    $("e-copied").textContent = "";
    countdown(); timer = window.setInterval(countdown, 30_000);
    try {
      const { stats } = (await (await fetch(`/api/stats?day=${day}`)).json()) as { stats: Stats };
      if (stats && alive) {
        $("e-stats").hidden = false;
        $("s-beat").textContent = stats.players > 1 ? `${stats.beatPct}%` : "–";
        $("s-streak").textContent = String(stats.streak);
        $("s-max").textContent = String(stats.maxStreak);
      }
    } catch {}
  }

  function setMode(m: Mode) {
    if (demo || S.locked || m === mode) return;
    mode = m; try { localStorage.setItem("hypeline:mode", m); } catch {}
    S = fresh(); render(); ui();
  }

  // "Watch how": a ghost finger runs the three peak-first steps, then the round resets.
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const tween = (ms: number, fn: (e: number, t: number) => void) => new Promise<void>((r) => { const t0 = performance.now(); const f = (now: number) => { const t = Math.min(1, (now - t0) / ms); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; fn(e, t); render(); if (t < 1 && alive) requestAnimationFrame(f); else r(); }; f(t0); });
  const cap = (step: string, txt: string) => { $("instr").innerHTML = `<span class="stp">${step}</span><span>${txt}</span>`; };
  async function runDemo() {
    if (demo || S.locked || S.mode !== "peak") return;
    demo = true; S = fresh(); ui();
    const G: NonNullable<State["ghost"]> = { x: X(80), y: Y(30), down: false };
    S.ghost = G;
    cap("Demo 1/3", "Tap the month you think searches peaked.");
    await tween(700, (e) => { G.x = X(80 + (40 - 80) * e); G.y = Y(30 + (60 - 30) * e); });
    G.down = true; setPeak(40); await wait(350);
    await tween(600, (e) => { const m = 40 + 6 * e; G.x = X(m); movePeak(m); });
    G.down = false; S.phase = "shape"; await wait(500);
    cap("Demo 2/3", "Sweep across to shape the rest.");
    const shapeV = (m: number) => (m < 46 ? 10 + 60 * Math.pow(m / 46, 2.2) : 30 + 55 * Math.exp(-(m - 46) / 14));
    await tween(500, (e) => { G.x = X(46 * (1 - e)); G.y = Y(shapeV(0) * e + 60 * (1 - e)); });
    G.down = true; last = null;
    await tween(1700, (_e, t) => { const m = t * (N - 1); G.x = X(m); G.y = Y(shapeV(m)); paintAt(m, shapeV(m)); });
    G.down = false; last = null; await wait(500);
    cap("Demo 3/3", "Drag a dot to nudge one part of the line.");
    const hq = 34, base = S.vals.slice() as number[], sv = S.vals[hq]!;
    await tween(500, (e) => { G.x = X(3 * hq + 1); G.y = Y(sv) + (1 - e) * 40; });
    G.down = true;
    await tween(800, (e) => { nudge(base, hq, 22 * e); G.y = Y(S.vals[hq]!); });
    G.down = false; await wait(700);
    cap("Your turn", "Now try it yourself.");
    await wait(1100);
    if (!alive) return;
    demo = false; S = fresh(); render(); ui();
  }

  const on = <K extends keyof HTMLElementEventMap>(id: string, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => $(id).addEventListener(ev, fn, opt);
  svg.addEventListener("pointerdown", onDown, opt);
  svg.addEventListener("pointermove", onMove, opt);
  svg.addEventListener("pointerup", up, opt);
  svg.addEventListener("pointercancel", up, opt);
  on("b-lock", "click", lock);
  on("b-clear", "click", () => { S = fresh(); render(); ui(); });
  on("b-next", "click", () => { if (round < ROUNDS - 1) { round++; loadRound(); } else showEnd(); });
  on("b-demo", "click", runDemo);
  on("m-peak", "click", () => setMode("peak"));
  on("m-free", "click", () => setMode("free"));
  on("b-copy", "click", () => {
    const txt = $("e-share").textContent || "";
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($("e-share")); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); $("e-copied").textContent = "Selected. Copy it with your device's copy command."; };
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { navigator.share({ text: txt }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(txt).then(() => { $("e-copied").textContent = "Copied to clipboard"; }, fallback); } catch { fallback(); }
  });

  // Start: fetch today's topics, then resume wherever this player left off today.
  S = fresh(); render(); ui();
  (async () => {
    try {
      const r = await fetch(`/api/puzzle?day=${day}`);
      if (!r.ok) throw new Error(String(r.status));
      const p = await r.json();
      if (!alive) return;
      topics = p.topics; puzzleNo = p.number;
      $("p-no").textContent = `#${puzzleNo}`;
    } catch {
      $("err").textContent = "Couldn't load today's puzzle. Refresh to try again.";
      return;
    }
    results = load().filter((x, i) => x && x.round === i);
    $("play").hidden = false; $("loading").hidden = true;
    if (results.length >= ROUNDS) { showEnd(); return; }
    round = results.length; loadRound();
  })();

  return () => {
    alive = false; ac.abort(); cancelAnimationFrame(raf); clearInterval(timer);
  };
}
