"use client";
// Markup for the game screen. All behavior lives in lib/game/engine.ts, which attaches to these ids.
import { useEffect, useRef } from "react";
import { mountGame } from "@/lib/game/engine.ts";
import { SITE_NAME } from "@/lib/site.ts";

const words = SITE_NAME.split(" ");
const head = words.slice(0, -1).join(" ");
const tail = words[words.length - 1];

export default function Game() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => mountGame(root.current!), []);

  return (
    <div className="app" ref={root}>
      <div className="top">
        <div className="brand">
          {head}<i>{tail}</i>
          <span className="proto" id="p-no"></span>
        </div>
        <div className="seg" role="radiogroup" aria-label="Drawing style">
          <button id="m-peak" type="button" role="radio" aria-checked="true">Peak first</button>
          <button id="m-free" type="button" role="radio" aria-checked="false">Freehand</button>
        </div>
      </div>
      <div className="dots" id="dots"></div>
      <p className="err" id="err" aria-live="polite"></p>

      <p className="instr" id="loading">Loading today&apos;s puzzle…</p>

      <div id="play" className="end" style={{ gap: 10 }} hidden>
        <div className="topic">
          <span className="k" id="t-k"></span>
          <span className="v" id="t-v"></span>
          <span className="c" id="t-c"></span>
        </div>
        <p className="instr" id="instr"></p>
        <div className="chartwrap">
          <svg id="chart" viewBox="0 0 360 250" role="img" aria-label="Chart of search interest from 2016 to 2025. Draw your guess on it."></svg>
        </div>
        <div className="legend" id="legend" hidden>
          <span><i></i>Real searches</span>
          <span><i className="you"></i>Your guess</span>
          <span id="l-crowd" hidden><i className="crowd"></i><span id="l-crowd-n">Everyone&apos;s average</span></span>
        </div>
        <div className="actions" id="actions">
          <button id="b-clear" type="button" className="btn sm">Clear</button>
          <button id="b-demo" type="button" className="btn">Watch how</button>
          <button id="b-lock" type="button" className="btn pri" disabled>Lock in</button>
        </div>
        <div className="result" id="result" hidden>
          <div className="rtop">
            <div className="score"><span id="r-score">0</span><small> /100</small></div>
            <span className="stamp" id="r-word"></span>
          </div>
          <div className="bd" id="r-bd"></div>
          <p className="fact" id="r-fact"></p>
          <div className="actions">
            <button id="b-next" type="button" className="btn pri">Next round</button>
          </div>
        </div>
      </div>

      <div id="end" className="end" hidden>
        <div className="endcard">
          <span className="proto">Today&apos;s result</span>
          <div className="score"><span id="e-total">0</span><small> /500</small></div>
          <div className="stats" id="e-stats" hidden>
            <div><b id="s-beat">–</b><span>players beaten</span></div>
            <div><b id="s-streak">0</b><span>day streak</span></div>
            <div><b id="s-max">0</b><span>best streak</span></div>
          </div>
          <div className="rows" id="e-rows"></div>
        </div>
        <div className="endcard">
          <span className="proto">Share</span>
          <pre className="share" id="e-share"></pre>
          <div className="actions"><button id="b-copy" type="button" className="btn acc">Share result</button></div>
          <div className="copied" id="e-copied" aria-live="polite"></div>
          <p className="next" id="e-next"></p>
        </div>
      </div>

      <div className="notes">
        <p><b>How to play.</b> Each day you get five topics. Guess how much the world searched each one from 2016 to 2025, then watch the real line race over yours.</p>
        <p><b>Peak first:</b> tap the month you think hype peaked, sweep to shape the rest, then drag the dots to nudge. <b>Freehand:</b> draw the whole line in one sweep.</p>
        <p><b>Scoring:</b> peak timing 40, shape across five two-year slices 45, where it ended 15.</p>
        <p>Test build: the curves are rough placeholder shapes, not real search data.</p>
      </div>
    </div>
  );
}
