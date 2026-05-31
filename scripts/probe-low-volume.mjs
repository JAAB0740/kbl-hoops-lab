// 슛 시도 적은 선수들로 KBL range 1-6 boundary 추적.
//
// 아이디어:
//   - 시즌 50-200 슛만 쏜 선수면 zone 패턴이 단순해서 어디 boundary 가 다른지 보임
//   - 특히 "원거리만 쏘는 슈터" / "림돌격만 하는 빅맨" / "특정 각도 전문" 선수가 유용
//   - KBL ranges 와 우리 측정치 차이가 일관되게 나오면 그게 boundary 정의 차이

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
const PX_PER_M = 160 / 6.75;  // 23.7 px per meter

function normalizeShot(raw) {
  const x = raw.d === "1" ? CANVAS_W - raw.x : raw.x;
  return { x, y: raw.y, made: raw.o === "O" };
}

function shotInfo(x, y) {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dy, dx);  // 0=midcourt, -π/2 = upper, +π/2 = lower
  // 각도 변환: 림 기준 0=정면, ±π=baseline
  const distM = d / PX_PER_M;
  // baseline strip 판정 (KBL 의 코너 3 line 기준)
  const inCornerStrip = x < 105 && (y < 55 || y > 355);
  const isThree = (d >= THREE_PT_R) || (inCornerStrip && x < 105);
  return { d, distM, theta, dx, dy, isThree, x, y };
}

const KBL_REG_TAGS = new Set(["정규리그"]);
const kblRegGmkeys = new Set(
  games.games.filter((g) => g.status === "final" && KBL_REG_TAGS.has(g.tag)).map((g) => g.gmkey),
);

// 모든 선수 별 raw shot 수집
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

// 저시도 선수 (50~200 슛) 추리기
const playerGames = new Map();
for (const p of playerDetail.splits.regularSeason ?? []) {
  if (p.playerNo) playerGames.set(p.playerNo, p.games ?? 0);
}

const candidates = [];
for (const p of shooting.players.regular) {
  const games = playerGames.get(p.playerNo) ?? 0;
  if (games === 0) continue;
  const total = p.ranges.reduce((s, r) => s + r.att * games, 0);
  if (total < 50 || total > 250) continue;
  const our = shotsByPcode.get(p.playerNo);
  if (!our || Math.abs(our.length - total) > 5) continue;  // 데이터 매칭되는 선수만
  candidates.push({
    pcode: p.playerNo,
    kname: p.kname,
    games,
    total,
    ranges: p.ranges,
    shots: our,
  });
}
candidates.sort((a, b) => a.total - b.total);

console.log(`저시도 선수 ${candidates.length} 명 (50~250 슛, 데이터 매칭)`);
console.log(`샘플 보여줄 선수: 슛 적고 패턴 명확한 5명\n`);

// 패턴 단순한 5명 선택: 슛 < 150
const sample = candidates.filter((c) => c.total < 150).slice(0, 5);

for (const c of sample) {
  console.log(`\n=== ${c.kname} (${c.pcode}, G=${c.games}, total=${c.total}) ===`);
  console.log(`KBL ranges: ${c.ranges.map((r) => `${r.range}=${(r.att * c.games).toFixed(0)}`).join(", ")}`);

  // 각 슛의 거리 + 각도 + 3pt 여부 산점도로
  const buckets = {};
  for (const s of c.shots) {
    const info = shotInfo(s.x, s.y);
    // 거리 1m bin × 각도 30° bin
    const dBin = Math.floor(info.distM);
    const angDeg = (info.theta * 180) / Math.PI;
    const absAng = Math.abs(angDeg);  // 0=정면, 180=뒤
    let angBin;
    if (absAng < 30) angBin = "top";
    else if (absAng < 75) angBin = "wing";
    else angBin = "corner";
    const key = `${dBin}m_${angBin}_${info.isThree ? "3" : "2"}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  console.log("  슛 분포 (거리 m × 각도):");
  const sortedKeys = Object.keys(buckets).sort((a, b) => {
    const da = parseInt(a), db = parseInt(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
  for (const k of sortedKeys) {
    console.log(`    ${k.padEnd(20)} ${buckets[k]}`);
  }
}

// 더 분석: 각 KBL range 의 "전형적인 슛" 이 어떤 거리/각도인지 역추적
// 한 명 매우 단순한 선수 — 거의 림+3점만 쏘는 3&D
console.log("\n\n=== 단순 패턴 선수 별 KBL range 누적 vs 우리 거리/각도 ===\n");

// 더 많은 후보 중 패턴 특이한 선수 골라보기
for (const c of candidates.slice(0, 20)) {
  // KBL 의 range 1+2 (림+페인트) 비율
  const r12 = (c.ranges[0].att + c.ranges[1].att) * c.games;
  const r3 = c.ranges[2].att * c.games;
  const r456 = (c.ranges[3].att + c.ranges[4].att + c.ranges[5].att) * c.games;
  const inPaintShare = r12 / c.total;
  const farShare = r456 / c.total;
  // 우리 측정 — distM 4.6m 기준
  let near = 0, mid = 0, far = 0;
  for (const s of c.shots) {
    const info = shotInfo(s.x, s.y);
    if (info.distM < 3) near++;
    else if (info.distM < 4.6) mid++;
    else far++;
  }
  console.log(`${c.kname.padEnd(10)} G=${c.games} N=${c.total} | KBL: 림+페=${r12.toFixed(0)}(${(inPaintShare*100).toFixed(0)}%) 미드=${r3.toFixed(0)} 원거리=${r456.toFixed(0)}(${(farShare*100).toFixed(0)}%) | 우리: <3m=${near}(${(near/c.total*100).toFixed(0)}%) 3-4.6m=${mid} >4.6m=${far}(${(far/c.total*100).toFixed(0)}%)`);
}
