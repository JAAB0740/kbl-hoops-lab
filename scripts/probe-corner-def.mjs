// KBL range 4-6 의 정확한 boundary 추적.
// 1, 2 단계는 fit 완료 (RIM_R=35, PAINT=[10,140]×[155,265]).
//
// 가설 후보 (range 4-6 = 코너/윙/탑):
//   H_A: 단순 3pt 영역 + angle wedge (우리 기존 가정)
//   H_B: 거리 ≥ X (long-2 포함) + angle wedge — 즉 ranges 4-6 = far shots, ranges 1-3 = near shots
//   H_C: 거리 ≥ X + arc 안/밖 + corner-baseline 영역 별도 처리
//   H_D: paint 박스 밖 + angle wedge (안에 paint 안 들어간 모든 슛)

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

// 1·2단계 fit 결과 적용
const RIM_R = 35;
const PAINT_X0 = 10, PAINT_X1 = 140, PAINT_Y0 = 155, PAINT_Y1 = 265;

function normalizeShot(raw) {
  const x = raw.d === "1" ? CANVAS_W - raw.x : raw.x;
  return { x, y: raw.y };
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

// 우선 KBL 의 range 3 영역만 식별 — 슛 좌표 분포 보기
// range 3 (미드) = 모든 슛 - range 1 - range 2 - range 4-6
// 즉 range 3 = paint 박스 밖 + 3pt 미만 거리 + corner 영역 아님

// 가설 별 classifier
function classifyA(x, y) {
  // 기존 우리 가정 — 3pt 외부 + angle wedge
  const dx = x - BASKET_X, dy = y - BASKET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < RIM_R) return 1;
  const inPaint = x >= PAINT_X0 && x <= PAINT_X1 && y >= PAINT_Y0 && y <= PAINT_Y1;
  if (inPaint) return 2;
  const inCorner3 = x < 105 && (y < 51 || y > 359);
  const isThree = dist >= THREE_PT_R || inCorner3;
  if (!isThree) return 3;
  const theta = Math.atan2(dy, dx), absT = Math.abs(theta);
  if (inCorner3 || absT > Math.PI * 0.75) return 4;
  if (absT < Math.PI * 0.15) return 6;
  return 5;
}

function classifyB(x, y, distThresh) {
  // 가설 B: ranges 4-6 = 거리 ≥ distThresh, 그 외 1-3
  const dx = x - BASKET_X, dy = y - BASKET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < RIM_R) return 1;
  const inPaint = x >= PAINT_X0 && x <= PAINT_X1 && y >= PAINT_Y0 && y <= PAINT_Y1;
  if (inPaint) return 2;
  if (dist < distThresh) return 3;
  // 4-6 분류 (각도)
  const theta = Math.atan2(dy, dx), absT = Math.abs(theta);
  // 베이스라인 측 (y < 50 or > 360) → corner
  const inCornerStrip = x < 105 && (y < 51 || y > 359);
  if (inCornerStrip || absT > Math.PI * 0.75) return 4;
  if (absT < Math.PI * 0.15) return 6;
  return 5;
}

function evalH(classifyFn) {
  let sseTotal = 0;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const our = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const kbl = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const pl of allPlayers) {
    const o = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const s of pl.shots) o[classifyFn(s.x, s.y)]++;
    for (let r = 1; r <= 6; r++) {
      const d = o[r] - pl.kblCounts[r];
      sseTotal += d * d;
      breakdown[r] += d * d;
      our[r] += o[r];
      kbl[r] += pl.kblCounts[r];
    }
  }
  return { sse: sseTotal, breakdown, our, kbl };
}

console.log("=== 가설 A (기존: 3pt 외부 + angle wedge) ===");
const rA = evalH(classifyA);
console.log(`SSE total = ${rA.sse.toFixed(0)}`);
for (let r = 1; r <= 6; r++) console.log(`  range ${r}: KBL=${rA.kbl[r].toFixed(0)} Ours=${rA.our[r]} diff=${(rA.our[r]-rA.kbl[r]).toFixed(0)} SSE=${rA.breakdown[r].toFixed(0)}`);

console.log("\n=== 가설 B (거리 ≥ X 가 ranges 4-6) — X sweep ===");
for (const X of [100, 110, 120, 130, 140, 150, 160]) {
  const r = evalH((x, y) => classifyB(x, y, X));
  console.log(`\n  distThresh=${X}px (${(X/23.7).toFixed(2)}m): SSE total = ${r.sse.toFixed(0)}`);
  for (let z = 1; z <= 6; z++) console.log(`    range ${z}: KBL=${r.kbl[z].toFixed(0)} Ours=${r.our[z]} diff=${(r.our[z]-r.kbl[z]).toFixed(0)}`);
}

// 가설 C: ranges 4-6 의 각도 wedge 도 grid sweep
console.log("\n=== 가설 C (B 최적값 + wedge angle grid sweep) ===");
const distThresh = 110;  // 위 결과 기반 best 추정
let bestC = null;
for (const cornerAng of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
  for (const topAng of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35]) {
    const fn = (x, y) => {
      const dx = x - BASKET_X, dy = y - BASKET_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RIM_R) return 1;
      const inPaint = x >= PAINT_X0 && x <= PAINT_X1 && y >= PAINT_Y0 && y <= PAINT_Y1;
      if (inPaint) return 2;
      if (dist < distThresh) return 3;
      const theta = Math.atan2(dy, dx), absT = Math.abs(theta);
      if (absT > Math.PI * cornerAng) return 4;
      if (absT < Math.PI * topAng) return 6;
      return 5;
    };
    const r = evalH(fn);
    if (!bestC || r.sse < bestC.sse) bestC = { cornerAng, topAng, ...r };
  }
}
console.log(`best: cornerAng=${bestC.cornerAng}π topAng=${bestC.topAng}π SSE=${bestC.sse.toFixed(0)}`);
for (let r = 1; r <= 6; r++) console.log(`  range ${r}: KBL=${bestC.kbl[r].toFixed(0)} Ours=${bestC.our[r]} diff=${(bestC.our[r]-bestC.kbl[r]).toFixed(0)} SSE=${bestC.breakdown[r].toFixed(0)}`);
