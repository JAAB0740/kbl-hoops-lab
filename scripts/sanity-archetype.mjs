// 분류기 sanity check — Stage 3 7단계 (올라운더 신규 추가).

import fs from "node:fs";

const detail = JSON.parse(fs.readFileSync("data/players-detail.json", "utf8"));
const adv = JSON.parse(fs.readFileSync("data/players-advanced.json", "utf8"));
const shooting = JSON.parse(fs.readFileSync("data/shooting.json", "utf8"));
const info = JSON.parse(fs.readFileSync("data/players-info.json", "utf8"));

const TH = {
  minGames: 10,
  minMinutesPerGame: 10,
  mainHandler:      { usgPctileMin: 75, astPctileMin: 75 },
  secondaryHandler: { astPctileMin: 65, usgPctileMin: 35 },
  big:              { heightMin: 195, trbPctileMin: 75, trbUsgPctileMax: 75, paintShareMin: 0.65, infoMissingPaintShareMin: 0.50 },
  highVolumeBig:    { usgPctileMin: 80 },
  stretchBig:       { threeShareMin: 0.30, threePctPctileMin: 50 },
  // Stage 3
  allRounder:       { usgPctMin: 17, astPctMin: 10, threePctMin: 32, rimAttPerGameMin: 1.5, paintShareMin: 0.35 },
  slasher:          { paintShareMin: 0.40, rimAttPerGameMin: 2.0, rimPctMin: 65 },
  true3AndD:        { threePctMin: 32, defActivityPctileMin: 55 },
  hustler:          { threePctMax: 32, orbPctMin: 5, stlPerGameMin: 1.0, blkPerGameMin: 0.5 },
  cornerSpacer:     { usgPctMax: 15, cornerWingShareMin: 0.50 },
  pureShooter:      { threeShareMin: 0.45, threePctMin: 33 },
};

const regular = detail.splits.regularSeason ?? [];
const advRegular = adv.splits.regularSeason ?? [];
const shootingRegular = shooting.players.regular ?? [];
const byPcode = info.byPcode ?? {};

const findAdv = (pn) => advRegular.find((e) => String(e.playerNo) === String(pn))?.advanced;
const findShoot = (pn) => shootingRegular.find((e) => String(e.playerNo) === String(pn))?.ranges;
const findInfo = (pn) => byPcode[String(pn)] ?? null;
const isQual = (r) => (r.games ?? 0) >= TH.minGames && (r.minutes ?? 0) / 60 >= TH.minMinutesPerGame;

const qualified = regular.filter(isQual).map((row) => ({
  playerNo: String(row.playerNo),
  row,
  adv: findAdv(row.playerNo),
  ranges: findShoot(row.playerNo),
}));

function sortedAsc(xs) { return xs.filter(Number.isFinite).slice().sort((a, b) => a - b); }
function percentileOf(v, sorted) {
  if (sorted.length === 0) return 0;
  if (v <= sorted[0]) return 0;
  if (v >= sorted[sorted.length - 1]) return 100;
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  return Math.round((lo / (sorted.length - 1)) * 100);
}
function shotShares(ranges) {
  if (!ranges) return null;
  const find = (n) => ranges.find((r) => r.range === n);
  const get = (n) => find(n)?.att ?? 0;
  const tot = ranges.reduce((s, r) => s + (r.att ?? 0), 0);
  if (tot <= 0) return null;
  const r4 = get(4), r5 = get(5), r6 = get(6);
  const total3 = r4 + r5 + r6;
  return {
    paint: (get(1) + get(2)) / tot,
    mid: get(3) / tot,
    three: total3 / tot,
    cornerWingOfThree: total3 > 0 ? (r4 + r5) / total3 : null,
    rimAtt: find(1)?.att ?? 0,
    rimPct: find(1)?.pct ?? 0,
  };
}
const defAct = (row) => (row.steals ?? 0) + (row.blocks ?? 0);

const SORTED = {
  usgPct: sortedAsc(qualified.map((q) => q.adv?.usgPct ?? NaN)),
  astPct: sortedAsc(qualified.map((q) => q.adv?.astPct ?? NaN)),
  rebPct: sortedAsc(qualified.map((q) => q.adv?.rebPct ?? NaN)),
  threePct: sortedAsc(qualified.map((q) => q.row.threePct)),
  defActivity: sortedAsc(qualified.map((q) => defAct(q.row))),
};

function classify(q) {
  const { row, adv: a, ranges } = q;
  const inf = findInfo(q.playerNo);
  const pos = inf?.pos ?? null;
  const height = inf?.pHeight ?? null;
  const flag = inf?.flag ?? null;

  const games = row.games ?? 0;
  const minPerG = (row.minutes ?? 0) / 60;
  if (games < TH.minGames || minPerG < TH.minMinutesPerGame) return { label: "표본 부족", row, sig: {} };

  const shares = shotShares(ranges);
  const threeShare = row.fgAtt > 0 ? row.threeAtt / row.fgAtt : 0;
  const paintShare = shares?.paint ?? null;
  const midShare = shares?.mid ?? null;
  const cornerWingOfThree = shares?.cornerWingOfThree ?? null;
  const rimAtt = shares?.rimAtt ?? null;
  const rimPct = shares?.rimPct ?? null;
  const orebPct = a?.orebPct ?? null;

  const usgPct = a?.usgPct ?? 0;
  const astPct = a?.astPct ?? 0;
  const rebPct = a?.rebPct ?? 0;
  const dA = defAct(row);

  const usgPctile = percentileOf(usgPct, SORTED.usgPct);
  const astPctile = percentileOf(astPct, SORTED.astPct);
  const rebPctile = percentileOf(rebPct, SORTED.rebPct);
  const threePctPctile = percentileOf(row.threePct, SORTED.threePct);
  const defPctile = percentileOf(dA, SORTED.defActivity);

  const sig = { usgPct, usgPctile, astPct, astPctile, rebPct, rebPctile, threeShare, paintShare, midShare, cornerWingOfThree, rimAtt, rimPct, orebPct, threePct: row.threePct, threePctPctile, defAct: dA, defPctile, pos, height };

  // Stage 1 — 빅맨 우선 (5-condition OR)
  const hTall = (height ?? 0) >= TH.big.heightMin;
  const isForeignBig = flag === "외국선수" && hTall;
  const isInfoMissingBig = !inf && (rebPctile >= TH.big.trbPctileMin || (paintShare != null && paintShare >= TH.big.infoMissingPaintShareMin));
  const isBig =
    pos === "C" ||
    (hTall && paintShare != null && paintShare >= TH.big.paintShareMin) ||
    (hTall && rebPctile >= TH.big.trbPctileMin && usgPctile <= TH.big.trbUsgPctileMax) ||
    isForeignBig ||
    isInfoMissingBig;
  if (isBig) {
    if (usgPctile >= TH.highVolumeBig.usgPctileMin) return { label: "고볼륨 스코어링 빅", row, sig };
    if (threeShare >= TH.stretchBig.threeShareMin && threePctPctile >= TH.stretchBig.threePctPctileMin)
      return { label: "스트레치 빅", row, sig };
    return { label: "롤맨", row, sig };
  }

  // Stage 2 — 핸들러 (빅맨 제외)
  if (usgPctile >= TH.mainHandler.usgPctileMin && astPctile >= TH.mainHandler.astPctileMin)
    return { label: "메인 핸들러", row, sig };
  if (astPctile >= TH.secondaryHandler.astPctileMin && usgPctile >= TH.secondaryHandler.usgPctileMin)
    return { label: "보조 핸들러", row, sig };

  // Stage 3 — 7단계
  // 3-1. 올라운더 (VIP)
  if (usgPct >= TH.allRounder.usgPctMin &&
      astPct >= TH.allRounder.astPctMin &&
      row.threePct >= TH.allRounder.threePctMin &&
      ((rimAtt != null && rimAtt >= TH.allRounder.rimAttPerGameMin)
        || (paintShare != null && paintShare >= TH.allRounder.paintShareMin)))
    return { label: "올라운더", row, sig };
  // 3-2. 슬래셔
  if ((paintShare != null && paintShare >= TH.slasher.paintShareMin)
      || (rimAtt != null && rimPct != null && rimAtt >= TH.slasher.rimAttPerGameMin && rimPct >= TH.slasher.rimPctMin))
    return { label: "슬래셔", row, sig };
  // 3-3. 트루 3&D
  if (row.threePct >= TH.true3AndD.threePctMin && defPctile >= TH.true3AndD.defActivityPctileMin)
    return { label: "트루 3&D", row, sig };
  // 3-4. 허슬러
  if (row.threePct < TH.hustler.threePctMax
      && ((orebPct != null && orebPct >= TH.hustler.orbPctMin)
        || row.steals >= TH.hustler.stlPerGameMin
        || row.blocks >= TH.hustler.blkPerGameMin))
    return { label: "허슬러", row, sig };
  // 3-5. 코너 스페이서
  if (usgPct <= TH.cornerSpacer.usgPctMax && cornerWingOfThree != null && cornerWingOfThree >= TH.cornerSpacer.cornerWingShareMin)
    return { label: "코너 스페이서", row, sig };
  // 3-6. 퓨어 슈터
  if (threeShare >= TH.pureShooter.threeShareMin && row.threePct >= TH.pureShooter.threePctMin)
    return { label: "퓨어 슈터", row, sig };
  // 3-7. 일반 윙
  return { label: "일반 윙", row, sig };
}

const results = qualified.map(classify);

const ORDER = [
  "메인 핸들러", "보조 핸들러",
  "고볼륨 스코어링 빅", "스트레치 빅", "롤맨",
  "올라운더", "슬래셔", "트루 3&D", "허슬러", "코너 스페이서", "퓨어 슈터", "일반 윙",
];

const dist = {};
for (const r of results) dist[r.label] = (dist[r.label] ?? 0) + 1;

console.log("=== Distribution (Qualified", qualified.length, ") ===");
for (const k of ORDER) if (dist[k]) console.log(`  ${k.padEnd(16)} ${String(dist[k]).padStart(3)}`);

// Stage 3 분포
console.log("\n=== Stage 3 윙 자원 7단계 ===");
const stage3 = ["올라운더", "슬래셔", "트루 3&D", "허슬러", "코너 스페이서", "퓨어 슈터", "일반 윙"];
let stage3Total = 0;
for (const k of stage3) {
  const n = dist[k] ?? 0;
  stage3Total += n;
  if (n > 0) console.log(`  ${k.padEnd(14)} ${String(n).padStart(3)}명`);
}
console.log(`  ─────────────────`);
console.log(`  합계           ${String(stage3Total).padStart(3)}명`);

// 카테고리별 샘플
console.log("\n=== Samples ===");
const byArch = {};
for (const r of results) (byArch[r.label] ??= []).push(r);
for (const arch of ORDER) {
  const rs = byArch[arch];
  if (!rs || rs.length === 0) continue;
  rs.sort((a, b) => (b.row.points ?? 0) - (a.row.points ?? 0));
  console.log(`\n[${arch}] · ${rs.length}명`);
  for (const r of rs.slice(0, 6)) {
    const t = r.row;
    const inf = findInfo(t.playerNo);
    const h = inf?.pHeight ? `${inf.pHeight}cm` : "—";
    const s = r.sig;
    const extra = [];
    if (arch === "올라운더")     extra.push(`USG ${s.usgPct?.toFixed(1)} · AST ${s.astPct?.toFixed(1)} · 림 ${s.rimAtt?.toFixed(1)}/G · paint ${(s.paintShare*100).toFixed(0)}%`);
    if (arch === "슬래셔")       extra.push(`paint ${(s.paintShare*100).toFixed(0)}% · 림 ${s.rimAtt?.toFixed(1)}/G(${s.rimPct?.toFixed(0)}%)`);
    if (arch === "트루 3&D")     extra.push(`3P% ${t.threePct.toFixed(1)} · STL+BLK ${s.defAct?.toFixed(1)}(P${s.defPctile})`);
    if (arch === "허슬러")       extra.push(`3P% ${t.threePct.toFixed(1)} · ORB% ${s.orebPct?.toFixed(1)} · STL ${t.steals.toFixed(2)} · BLK ${t.blocks.toFixed(2)}`);
    if (arch === "코너 스페이서") extra.push(`USG ${s.usgPct?.toFixed(1)} · 코너+윙 ${(s.cornerWingOfThree*100).toFixed(0)}%`);
    if (arch === "퓨어 슈터")     extra.push(`3PA${(s.threeShare*100).toFixed(0)}% · 3P${t.threePct.toFixed(1)}`);
    console.log(`  ${t.kname.padEnd(10)} ${t.teamName4.padEnd(8)} ${h.padEnd(6)} ${t.points.toFixed(1)}/${t.rebounds.toFixed(1)}/${t.assists.toFixed(1)}${extra.length?" · "+extra.join(" · "):""}`);
  }
}

// 엣지 케이스 재검증
console.log("\n=== 엣지 케이스 검증 ===");
const TARGETS = [
  // 빅맨 우선 라우팅 확인 (외국선수 빅이 핸들러로 흡수되던 오분류 차단)
  { name: "자밀 워니",       expected: "빅맨 (USG P96 → 고볼륨 스코어링 빅)" },
  { name: "케렘 칸터",       expected: "빅맨 카테고리" },
  { name: "아셈 마레이",     expected: "빅맨 카테고리" },
  { name: "조니 오브라이언트", expected: "빅맨 카테고리" },
  { name: "라건아",          expected: "빅맨 카테고리" },
  { name: "레이션 해먼즈",   expected: "빅맨 (고볼륨 스코어링 빅 추정)" },
  // 기존 의도 유지 확인
  { name: "이승현",          expected: "롤맨" },
  { name: "최준용",          expected: "보조 핸들러 또는 올라운더" },
  { name: "송교창",          expected: "올라운더" },
  { name: "안영준",          expected: "올라운더" },
  { name: "문성곤",          expected: "허슬러" },
  { name: "박정웅",          expected: "트루 3&D" },
];
for (const t of TARGETS) {
  const q = qualified.find((x) => x.row.kname === t.name);
  if (!q) { console.log(`  ${t.name.padEnd(10)} → (자격 미달/없음)`); continue; }
  const r = classify(q);
  const s = r.sig;
  console.log(`  ${t.name.padEnd(10)} → [${r.label}]    (기대: ${t.expected})`);
  console.log(`     USG ${s.usgPct?.toFixed(1)}% · AST ${s.astPct?.toFixed(1)}% · 3P% ${s.threePct?.toFixed(1)}% · paint ${s.paintShare!=null?(s.paintShare*100).toFixed(1)+"%":"—"} · 림 ${s.rimAtt?.toFixed(2)}/G(${s.rimPct?.toFixed(1)}%) · STL ${q.row.steals.toFixed(2)} · BLK ${q.row.blocks.toFixed(2)} · ORB% ${s.orebPct?.toFixed(1)}`);
}
