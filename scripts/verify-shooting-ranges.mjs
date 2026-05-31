// KBL range 1-6 의 정체 추적 — 단순 6존이 아닌 듯. 추가 가설 검증.
//
// 가설 후보:
//   H1. range 1-3 = 2pt only, range 4-6 = 3pt only (라벨 그대로) — FAIL (워니 검증)
//   H2. range 4-6 = 각도 기반 (코너/윙/탑 모든 거리) — 일부 2pt 포함
//   H3. range 별 거리 bin (예: r<1m, 1-3m, 3-5m, 5-6.75m, 6.75m 이상)
//   H4. zone × made/missed 분리 (pct 가 다른 값)
//   H5. 코너 3점 = arc 안쪽 baseline 영역 (long 2 baseline 포함)

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
  return { x, y: raw.y, made: raw.o === "O" };
}

// 추가 검증: 각도 기반 + 거리 기반 분류 시도
function classifyByAngle(x, y) {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const theta = Math.atan2(dy, dx);
  // 각도만으로 좌/정면/우 zone
  const absT = Math.abs(theta);
  if (absT > Math.atan2(155, 39.7)) return "corner_angle";  // 코너 각도
  if (absT > Math.PI / 6) return "wing_angle";              // 윙 각도
  return "top_angle";                                        // 탑 각도
}

function isInArc(x, y) {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  return (dx * dx + dy * dy) < THREE_PT_R * THREE_PT_R;
}

function classifyByDistance(x, y) {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const d = Math.sqrt(dx * dx + dy * dy);
  // 24.14 px/m. 림 r=1.25m=30, paint=4.9m=118, FT=4.18m=101, 3pt=6.75m=163
  if (d < 30)  return "d1_<1.25m";
  if (d < 70)  return "d2_1.25-2.9m";
  if (d < 110) return "d3_2.9-4.6m";
  if (d < 145) return "d4_4.6-6.0m";  // long 2
  if (d < 160) return "d5_6.0-6.6m";  // very deep 2 (just inside arc)
  if (d < 180) return "d6_6.6-7.5m";  // corner 3 distance
  return "d7_>7.5m";                   // deep 3
}

const KBL_REG_TAGS = new Set(["정규리그"]);
const kblRegGmkeys = new Set(
  games.games.filter((g) => g.status === "final" && KBL_REG_TAGS.has(g.tag)).map((g) => g.gmkey),
);

// 자밀 워니 (291248) 만 자세히 분석
const TARGET = "291248";
const TARGET_NAME = "자밀 워니";

const buckets = {
  byDistance: {},
  byAngleArc: { corner_3pt: 0, wing_3pt: 0, top_3pt: 0, corner_2pt: 0, wing_2pt: 0, top_2pt: 0 },
  rawByXY: [],
};

for (const gmkey of Object.keys(matchCharts.byGmkey)) {
  if (!kblRegGmkeys.has(gmkey)) continue;
  const sl = matchCharts.byGmkey[gmkey].shootLog ?? [];
  for (const p of sl) {
    if (p.pcode !== TARGET || !p.logs) continue;
    for (const raw of p.logs) {
      const n = normalizeShot(raw);
      const dBin = classifyByDistance(n.x, n.y);
      buckets.byDistance[dBin] = (buckets.byDistance[dBin] ?? 0) + 1;
      const inArc = isInArc(n.x, n.y);
      const angle = classifyByAngle(n.x, n.y);
      const key = `${angle.replace("_angle", "")}_${inArc ? "2pt" : "3pt"}`;
      buckets.byAngleArc[key] = (buckets.byAngleArc[key] ?? 0) + 1;
    }
  }
}

// KBL 워니 ranges
const wani = shooting.players.regular.find((p) => p.playerNo === TARGET);
const games2 = playerDetail.splits.regularSeason.find((p) => p.playerNo === TARGET)?.games ?? 0;

console.log(`=== ${TARGET_NAME} (G=${games2}) ===\n`);

console.log("KBL ranges (시즌 누적, att × G):");
for (const r of wani.ranges) {
  console.log(`  range ${r.range}: ${(r.att * games2).toFixed(0)} (att/G=${r.att.toFixed(2)}, made/G=${r.made.toFixed(2)}, pct=${r.pct.toFixed(1)}%)`);
}
const kblTotal = wani.ranges.reduce((s, r) => s + r.att * games2, 0);
console.log(`  합계: ${kblTotal.toFixed(0)}`);
console.log(`  3pt 합 (range 4+5+6): ${((wani.ranges[3].att + wani.ranges[4].att + wani.ranges[5].att) * games2).toFixed(0)}`);

const playerStat = playerDetail.splits.regularSeason.find((p) => p.playerNo === TARGET);
console.log(`\nplayers-detail 통계 (시즌 누적):`);
console.log(`  twoAtt (실은 total FGA): ${(playerStat.twoAtt * games2).toFixed(0)}`);
console.log(`  fgAtt (실은 2pt only):   ${(playerStat.fgAtt * games2).toFixed(0)}`);
console.log(`  threeAtt (3pt only):     ${(playerStat.threeAtt * games2).toFixed(0)}`);

console.log(`\n우리 측정 — 거리 bin:`);
const distOrder = ["d1_<1.25m", "d2_1.25-2.9m", "d3_2.9-4.6m", "d4_4.6-6.0m", "d5_6.0-6.6m", "d6_6.6-7.5m", "d7_>7.5m"];
let acc = 0;
for (const b of distOrder) {
  const v = buckets.byDistance[b] ?? 0;
  acc += v;
  console.log(`  ${b.padEnd(16)} ${String(v).padStart(4)}  (누적 ${acc})`);
}
console.log(`  합계: ${acc}`);

console.log(`\n우리 측정 — 각도 × arc inside/outside:`);
const aOrder = ["corner_2pt", "wing_2pt", "top_2pt", "corner_3pt", "wing_3pt", "top_3pt"];
for (const k of aOrder) {
  const v = buckets.byAngleArc[k] ?? 0;
  console.log(`  ${k.padEnd(15)} ${String(v).padStart(4)}`);
}
const ourCornerAll = (buckets.byAngleArc.corner_2pt ?? 0) + (buckets.byAngleArc.corner_3pt ?? 0);
const ourWingAll = (buckets.byAngleArc.wing_2pt ?? 0) + (buckets.byAngleArc.wing_3pt ?? 0);
const ourTopAll = (buckets.byAngleArc.top_2pt ?? 0) + (buckets.byAngleArc.top_3pt ?? 0);
console.log(`\n  각도 합 (2pt+3pt 모두):`);
console.log(`    corner 전체: ${ourCornerAll}  (KBL range 4 = ${(wani.ranges[3].att * games2).toFixed(0)})`);
console.log(`    wing 전체:   ${ourWingAll}  (KBL range 5 = ${(wani.ranges[4].att * games2).toFixed(0)})`);
console.log(`    top 전체:    ${ourTopAll}  (KBL range 6 = ${(wani.ranges[5].att * games2).toFixed(0)})`);
