// KBL range 1-6 의 정확한 boundary 를 parameter sweep 으로 찾기.
//
// 가설: KBL zone 정의는 우리와 같은 6존이지만 boundary 값이 다름.
//   - RIM_R (림 반지름)
//   - PAINT 박스 (KBL 페인트 정의)
//   - 코너 strip 너비/길이
//   - top wedge 각도
//   - wing wedge 각도
//
// 슛시도 적고 패턴 명확한 선수들로 parameter sweep → SSE 최소화

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const shooting = JSON.parse(fs.readFileSync(path.join(ROOT, "data/shooting.json"), "utf-8"));
const matchCharts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/match-charts.json"), "utf-8"));
const games = JSON.parse(fs.readFileSync(path.join(ROOT, "data/games.json"), "utf-8"));
const playerDetail = JSON.parse(fs.readFileSync(path.join(ROOT, "data/players-detail.json"), "utf-8"));

const BASKET_X = 60, BASKET_Y = 205;
const THREE_PT_R = 160;
const CANVAS_W = 720;

function normalizeShot(raw) {
  const x = raw.d === "1" ? CANVAS_W - raw.x : raw.x;
  return { x, y: raw.y };
}

// 6존 classifier — parameter 받음
function classify6(x, y, P) {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // 코너 strip (3pt corner)
  const inCornerStrip = x < P.CORNER_X_MAX && (y < P.CORNER_Y_LO || y > P.CORNER_Y_HI);
  // 림 영역
  if (dist < P.RIM_R) return 1;  // range 1 = 림
  // 페인트 박스
  const inPaint =
    x >= P.PAINT_X0 && x <= P.PAINT_X1 && y >= P.PAINT_Y0 && y <= P.PAINT_Y1;
  if (inPaint) return 2;  // range 2 = 페인트
  // 3pt 외부?
  const isThree = dist >= THREE_PT_R || inCornerStrip;
  if (!isThree) return 3;  // range 3 = 미드
  // 3pt — 각도로 corner/wing/top 분류
  // theta: -π/2 = 상단, +π/2 = 하단, 0 = 정면, ±π = 베이스라인
  const theta = Math.atan2(dy, dx);
  const absT = Math.abs(theta);
  // baseline 쪽 각도가 corner. midcourt 쪽이 top.
  if (absT > P.CORNER_ANGLE_MIN) return 4;  // 코너 3 (베이스라인 측)
  if (absT < P.TOP_ANGLE_MAX) return 6;     // 탑 3 (정면)
  return 5;                                  // 윙 3
}

const KBL_REG_TAGS = new Set(["정규리그"]);
const kblRegGmkeys = new Set(
  games.games.filter((g) => g.status === "final" && KBL_REG_TAGS.has(g.tag)).map((g) => g.gmkey),
);

const shotsByPcode = new Map();
for (const gmkey of Object.keys(matchCharts.byGmkey)) {
  if (!kblRegGmkeys.has(gmkey)) continue;
  const sl = matchCharts.byGmkey[gmkey].shootLog ?? [];
  for (const p of sl) {
    if (!p.pcode || !p.logs) continue;
    if (!shotsByPcode.has(p.pcode)) shotsByPcode.set(p.pcode, []);
    for (const raw of p.logs) shotsByPcode.get(p.pcode).push(normalizeShot(raw));
  }
}

const playerGames = new Map();
for (const p of playerDetail.splits.regularSeason ?? []) {
  if (p.playerNo) playerGames.set(p.playerNo, p.games ?? 0);
}

// 모든 선수 (full volume 포함, 신뢰성 위해)
const allPlayers = [];
for (const p of shooting.players.regular) {
  const games = playerGames.get(p.playerNo) ?? 0;
  if (games === 0) continue;
  const kblTotal = p.ranges.reduce((s, r) => s + r.att * games, 0);
  const shots = shotsByPcode.get(p.playerNo);
  if (!shots || Math.abs(shots.length - kblTotal) > 5) continue;
  const kblCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const r of p.ranges) kblCounts[r.range] = r.att * games;
  allPlayers.push({ pcode: p.playerNo, kname: p.kname, shots, kblCounts, total: shots.length });
}
console.log(`매칭된 선수: ${allPlayers.length} 명`);

// 슛 좌표 통계로 zone 별 boundary 후보 추정
// 1) 모든 슛 산점도 → KBL ranges 와 매치되는 boundary 사이의 grid 탐색

// Parameter grid
const grid = {
  RIM_R: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
  PAINT_X0: [10, 20, 25, 30],
  PAINT_X1: [140, 150, 160, 162, 170, 175, 180],
  PAINT_Y0: [125, 135, 145, 150, 155],
  PAINT_Y1: [255, 260, 265, 275, 285],
  CORNER_X_MAX: [40, 50, 60, 70, 80, 90, 100],
  CORNER_Y_LO: [40, 50, 55, 60, 65, 70],
  CORNER_Y_HI: [340, 350, 355, 360],
  CORNER_ANGLE_MIN: [Math.PI*0.65, Math.PI*0.7, Math.PI*0.75, Math.PI*0.8, Math.PI*0.85, Math.PI*0.9],
  TOP_ANGLE_MAX: [Math.PI*0.05, Math.PI*0.1, Math.PI*0.15, Math.PI*0.2, Math.PI*0.25],
};

// 너무 큰 grid 라서 단계별 fit (greedy):
// 단계 1) RIM_R fit — KBL range 1 (림) totals 와 매칭
// 단계 2) PAINT 박스 fit — KBL range 2 totals
// 단계 3) corner strip / corner angle — KBL range 4 totals
// 단계 4) top wedge angle — KBL range 6 totals
// (range 3, 5 는 잔여)

function evalParams(P) {
  let sse = 0;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const pl of allPlayers) {
    const our = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const s of pl.shots) our[classify6(s.x, s.y, P)]++;
    for (let r = 1; r <= 6; r++) {
      const diff = our[r] - pl.kblCounts[r];
      sse += diff * diff;
      breakdown[r] += diff * diff;
    }
  }
  return { sse, breakdown };
}

// 1단계: RIM_R fit
console.log("\n=== 1단계: RIM_R fit (range 1 = 림 boundary) ===");
const baseP = {
  RIM_R: 70, PAINT_X0: 20, PAINT_X1: 162, PAINT_Y0: 146, PAINT_Y1: 264,
  CORNER_X_MAX: 100, CORNER_Y_LO: 50, CORNER_Y_HI: 360,
  CORNER_ANGLE_MIN: Math.PI * 0.7, TOP_ANGLE_MAX: Math.PI * 0.15,
};
let bestRIM = null;
for (const v of grid.RIM_R) {
  const P = { ...baseP, RIM_R: v };
  let sseR1 = 0;
  for (const pl of allPlayers) {
    let our1 = 0;
    for (const s of pl.shots) if (classify6(s.x, s.y, P) === 1) our1++;
    const d = our1 - pl.kblCounts[1];
    sseR1 += d * d;
  }
  console.log(`  RIM_R=${v}: SSE(range1) = ${sseR1.toFixed(0)}`);
  if (!bestRIM || sseR1 < bestRIM.sse) bestRIM = { v, sse: sseR1 };
}
console.log(`  → best RIM_R = ${bestRIM.v} (SSE=${bestRIM.sse.toFixed(0)})`);
baseP.RIM_R = bestRIM.v;

// 2단계: PAINT 박스 fit (range 2)
console.log("\n=== 2단계: PAINT 박스 fit (range 2 = 페인트 boundary) ===");
let bestPAINT = null;
for (const x0 of grid.PAINT_X0) for (const x1 of grid.PAINT_X1) for (const y0 of grid.PAINT_Y0) for (const y1 of grid.PAINT_Y1) {
  const P = { ...baseP, PAINT_X0: x0, PAINT_X1: x1, PAINT_Y0: y0, PAINT_Y1: y1 };
  let sseR2 = 0;
  for (const pl of allPlayers) {
    let our2 = 0;
    for (const s of pl.shots) if (classify6(s.x, s.y, P) === 2) our2++;
    const d = our2 - pl.kblCounts[2];
    sseR2 += d * d;
  }
  if (!bestPAINT || sseR2 < bestPAINT.sse) bestPAINT = { x0, x1, y0, y1, sse: sseR2 };
}
console.log(`  → best PAINT: x=[${bestPAINT.x0}, ${bestPAINT.x1}] y=[${bestPAINT.y0}, ${bestPAINT.y1}] (SSE=${bestPAINT.sse.toFixed(0)})`);
Object.assign(baseP, { PAINT_X0: bestPAINT.x0, PAINT_X1: bestPAINT.x1, PAINT_Y0: bestPAINT.y0, PAINT_Y1: bestPAINT.y1 });

// 3단계: 코너 strip fit (range 4)
console.log("\n=== 3단계: 코너 strip + angle fit (range 4 = 코너 3) ===");
let bestCORNER = null;
for (const xm of grid.CORNER_X_MAX) for (const yl of grid.CORNER_Y_LO) for (const yh of grid.CORNER_Y_HI) for (const am of grid.CORNER_ANGLE_MIN) {
  const P = { ...baseP, CORNER_X_MAX: xm, CORNER_Y_LO: yl, CORNER_Y_HI: yh, CORNER_ANGLE_MIN: am };
  let sseR4 = 0;
  for (const pl of allPlayers) {
    let our4 = 0;
    for (const s of pl.shots) if (classify6(s.x, s.y, P) === 4) our4++;
    const d = our4 - pl.kblCounts[4];
    sseR4 += d * d;
  }
  if (!bestCORNER || sseR4 < bestCORNER.sse) bestCORNER = { xm, yl, yh, am, sse: sseR4 };
}
console.log(`  → best CORNER: x<${bestCORNER.xm}, y<${bestCORNER.yl}|>${bestCORNER.yh}, angle>${(bestCORNER.am/Math.PI).toFixed(2)}π (SSE=${bestCORNER.sse.toFixed(0)})`);
Object.assign(baseP, {
  CORNER_X_MAX: bestCORNER.xm, CORNER_Y_LO: bestCORNER.yl,
  CORNER_Y_HI: bestCORNER.yh, CORNER_ANGLE_MIN: bestCORNER.am,
});

// 4단계: top wedge angle (range 6)
console.log("\n=== 4단계: TOP wedge angle fit (range 6 = 탑 3) ===");
let bestTOP = null;
for (const tm of grid.TOP_ANGLE_MAX) {
  const P = { ...baseP, TOP_ANGLE_MAX: tm };
  let sseR6 = 0;
  for (const pl of allPlayers) {
    let our6 = 0;
    for (const s of pl.shots) if (classify6(s.x, s.y, P) === 6) our6++;
    const d = our6 - pl.kblCounts[6];
    sseR6 += d * d;
  }
  if (!bestTOP || sseR6 < bestTOP.sse) bestTOP = { tm, sse: sseR6 };
}
console.log(`  → best TOP_ANGLE_MAX = ${(bestTOP.tm/Math.PI).toFixed(2)}π (SSE=${bestTOP.sse.toFixed(0)})`);
baseP.TOP_ANGLE_MAX = bestTOP.tm;

// 최종 평가
console.log("\n=== 최종 best parameters ===");
console.log(JSON.stringify(baseP, null, 2));
const final = evalParams(baseP);
console.log("\n=== 잔차 분석 (zone 별 SSE) ===");
for (let r = 1; r <= 6; r++) console.log(`  range ${r}: ${final.breakdown[r].toFixed(0)}`);
console.log(`  total SSE: ${final.sse.toFixed(0)}`);

// 리그 전체 매칭 비교
const ourLeague = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
const kblLeague = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
for (const pl of allPlayers) {
  for (const s of pl.shots) ourLeague[classify6(s.x, s.y, baseP)]++;
  for (let r = 1; r <= 6; r++) kblLeague[r] += pl.kblCounts[r];
}
console.log("\n=== 리그 전체 매칭 (best params 적용) ===");
console.log("range  KBL_total  Our_total  Diff");
for (let r = 1; r <= 6; r++) {
  const k = kblLeague[r];
  const o = ourLeague[r];
  console.log(`  ${r}   ${k.toFixed(0).padStart(8)}  ${o.toString().padStart(8)}  ${(o - k).toFixed(0).padStart(6)}`);
}
