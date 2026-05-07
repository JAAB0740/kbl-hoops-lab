/**
 * KBL 2차 스탯(advanced) 자동 fetch — 팀 + 선수
 *
 * 출력:
 *   - data/team-advanced.json   { all, home, away, r1~r6, q1~q4, h1, h2 }
 *   - data/players-advanced.json { regularSeason, playoff, round.r1~r6 }
 *
 * 실행: npm run fetch:kbl-advanced
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
};

const TEAM_BASE = "https://api-stats.kbl.or.kr/api/records/team/general/advanced";
const PLAYER_BASE = "https://api-stats.kbl.or.kr/api/records/player/general/advanced";
const COMMON = {
  seasonCode: "47",
  perCn: "1",
  lastCn: "0",
  draftNo: "0",
};

function buildUrl(base, extra) {
  const p = { ...COMMON, ...extra };
  return base + "?" + Object.entries(p).map(([k, v]) => `${k}=${v}`).join("&");
}

const TEAM_SHORT_MAP = {
  LG: "LG", "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  DB: "DB", SK: "SK", SONO: "소노", KCC: "KCC", KT: "KT",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
};
function normShort(s) {
  if (!s) return s;
  const t = String(s).trim();
  return TEAM_SHORT_MAP[t] ?? t;
}

// ─── 정규화 ─────────────────────────────────

function normTeamRow(r) {
  return {
    rank: r.rankNo,
    code: r.teamCode,
    name: r.teamName1,
    shortName: normShort(r.teamName4),
    games: r.gameCount,
    wins: r.win,
    losses: r.lose,
    playMin: r.playMin,
    advanced: {
      offRtg: r.offrtg,
      defRtg: r.defrtg,
      netRtg: r.netrtg,
      efgPct: r.efgRt,
      tsPct: r.tsRt,
      astPct: r.astRt,
      astTo: r.astTo,
      astRatio: r.astRatio,
      orebPct: r.orebRt,
      drebPct: r.drebRt,
      rebPct: r.rebRt,
      tovPct: r.tovRt,
      pace: r.pace,
      pie: r.pie,
      poss: r.poss,
    },
  };
}

function normPlayerRow(r) {
  return {
    rank: r.rankNo,
    playerNo: String(r.playerNo),
    kname: r.kname,
    ename: r.ename,
    teamCode: r.teamCode,
    teamName1: r.teamName1,
    teamName4: normShort(r.teamName4),
    games: r.gameCount,
    wins: r.win,
    losses: r.lose,
    playSec: r.playSec,
    advanced: {
      per: r.perRt,
      offRtg: r.offrtg,
      defRtg: r.defrtg,
      netRtg: r.netrtg,
      efgPct: r.efgRt,
      tsPct: r.tsRt,
      astPct: r.astRt,
      astTo: r.astTo,
      astRatio: r.astRatio,
      orebPct: r.orebRt,
      drebPct: r.drebRt,
      rebPct: r.rebRt,
      usgPct: r.usgRt,
      pace: r.pace,
      tovPct: r.tovRt,
      toRatio: r.toRatio,
      pie: r.pie,
      poss: r.poss,
    },
  };
}

async function fetchOne(label, base, params, normalize) {
  const url = buildUrl(base, params);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ${label.padEnd(10)} ✗ HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const arr = (json?.data ?? []).map(normalize);
    console.log(`  ${label.padEnd(10)} ✓ ${arr.length}개`);
    return arr;
  } catch (e) {
    console.log(`  ${label.padEnd(10)} ✗ ${e.message}`);
    return [];
  }
}

// ─── 팀 ─────────────────────────────────────
console.log(`[1/2] 팀 advanced 수집`);

const TEAM_FETCHES = [
  { key: "all",  label: "전체",     params: { gameCode: "01", partIfList: "0" } },
  { key: "home", label: "홈",       params: { gameCode: "01", partIfList: "0", homeAwaySc: "1" } },
  { key: "away", label: "원정",     params: { gameCode: "01", partIfList: "0", homeAwaySc: "2" } },
  { key: "r1",   label: "1라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "1" } },
  { key: "r2",   label: "2라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "2" } },
  { key: "r3",   label: "3라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "3" } },
  { key: "r4",   label: "4라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "4" } },
  { key: "r5",   label: "5라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "5" } },
  { key: "r6",   label: "6라운드",  params: { gameCode: "01", partSc: "ROUND", partIfList: "6" } },
  { key: "q1",   label: "1쿼터",   params: { gameCode: "01", partIfList: "0", quarterSc: "Q1" } },
  { key: "q2",   label: "2쿼터",   params: { gameCode: "01", partIfList: "0", quarterSc: "Q2" } },
  { key: "q3",   label: "3쿼터",   params: { gameCode: "01", partIfList: "0", quarterSc: "Q3" } },
  { key: "q4",   label: "4쿼터",   params: { gameCode: "01", partIfList: "0", quarterSc: "Q4" } },
  { key: "h1",   label: "전반",     params: { gameCode: "01", partIfList: "0", quarterSc: "Q1,Q2" } },
  { key: "h2",   label: "후반",     params: { gameCode: "01", partIfList: "0", quarterSc: "Q3,Q4" } },
  { key: "po",   label: "PO",       params: { gameCode: "03,04", partIfList: "0" } }, // 03 PO + 04 챔결 합산
  // 홈 × 라운드
  { key: "home_r1", label: "홈 R1",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "1" } },
  { key: "home_r2", label: "홈 R2",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "2" } },
  { key: "home_r3", label: "홈 R3",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "3" } },
  { key: "home_r4", label: "홈 R4",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "4" } },
  { key: "home_r5", label: "홈 R5",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "5" } },
  { key: "home_r6", label: "홈 R6",  params: { gameCode: "01", homeAwaySc: "1", partSc: "ROUND", partIfList: "6" } },
  // 원정 × 라운드
  { key: "away_r1", label: "원정 R1", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "1" } },
  { key: "away_r2", label: "원정 R2", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "2" } },
  { key: "away_r3", label: "원정 R3", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "3" } },
  { key: "away_r4", label: "원정 R4", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "4" } },
  { key: "away_r5", label: "원정 R5", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "5" } },
  { key: "away_r6", label: "원정 R6", params: { gameCode: "01", homeAwaySc: "2", partSc: "ROUND", partIfList: "6" } },
];

const teamFilters = {};
for (const f of TEAM_FETCHES) {
  teamFilters[f.key] = await fetchOne(f.label, TEAM_BASE, f.params, normTeamRow);
  // 본 리그 10팀만 (advanced 응답에 KBL 평균 row가 들어가는 경우 대비)
  teamFilters[f.key] = teamFilters[f.key].filter((t) =>
    Object.values(TEAM_SHORT_MAP).includes(t.shortName) ||
    ["LG", "DB", "SK", "KCC", "KT"].includes(t.shortName),
  );
  await new Promise((r) => setTimeout(r, 150));
}

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/team-advanced.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/team/general/advanced",
      seasonCode: "47",
      filters: teamFilters,
    },
    null,
    2,
  ),
);
console.log(`✓ data/team-advanced.json 저장 (${Object.keys(teamFilters).length}개 split)`);

// ─── 선수 ───────────────────────────────────
console.log(`\n[2/2] 선수 advanced 수집`);

const PLAYER_FETCHES = [
  { key: "regularSeason", label: "정규 평균", params: { gameCode: "01", partIfList: "0" } },
  { key: "playoff",       label: "PO 평균",   params: { gameCode: "03,04", partIfList: "0" } }, // 03 PO + 04 챔결 합산
  { key: "championship",  label: "CF 평균",   params: { gameCode: "04", partIfList: "0" } },     // 챔결만 별도
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `r${i + 1}`,
    label: `${i + 1}라운드`,
    params: { gameCode: "01", partSc: "ROUND", partIfList: String(i + 1) },
  })),
  // 홈/원정/쿼터/전후반
  { key: "home", label: "홈",   params: { gameCode: "01", partIfList: "0", homeAwaySc: "1" } },
  { key: "away", label: "원정", params: { gameCode: "01", partIfList: "0", homeAwaySc: "2" } },
  { key: "q1",   label: "1쿼터", params: { gameCode: "01", partIfList: "0", quarterSc: "Q1" } },
  { key: "q2",   label: "2쿼터", params: { gameCode: "01", partIfList: "0", quarterSc: "Q2" } },
  { key: "q3",   label: "3쿼터", params: { gameCode: "01", partIfList: "0", quarterSc: "Q3" } },
  { key: "q4",   label: "4쿼터", params: { gameCode: "01", partIfList: "0", quarterSc: "Q4" } },
  { key: "h1",   label: "전반",  params: { gameCode: "01", partIfList: "0", quarterSc: "Q1,Q2" } },
  { key: "h2",   label: "후반",  params: { gameCode: "01", partIfList: "0", quarterSc: "Q3,Q4" } },
];

const playerSplits = { round: {} };
for (const f of PLAYER_FETCHES) {
  const data = await fetchOne(f.label, PLAYER_BASE, f.params, normPlayerRow);
  if (f.key.startsWith("r") && f.key.length <= 2) {
    playerSplits.round[f.key] = data;
  } else {
    playerSplits[f.key] = data;
  }
  await new Promise((r) => setTimeout(r, 150));
}

writeFileSync(
  "data/players-advanced.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/player/general/advanced",
      seasonCode: "47",
      splits: playerSplits,
    },
    null,
    2,
  ),
);
console.log(`✓ data/players-advanced.json 저장`);

// 샘플 출력
const lg = teamFilters.all?.find((t) => t.shortName === "LG");
if (lg) {
  console.log(`\n샘플 — 창원 LG (전체):`);
  const a = lg.advanced;
  console.log(`  ORtg ${a.offRtg.toFixed(1)} · DRtg ${a.defRtg.toFixed(1)} · Net ${a.netRtg.toFixed(1)}`);
  console.log(`  eFG% ${a.efgPct.toFixed(1)} · TS% ${a.tsPct.toFixed(1)} · Pace ${a.pace.toFixed(1)}`);
}

const wonny = playerSplits.regularSeason?.find((p) => p.kname === "자밀 워니");
if (wonny) {
  console.log(`\n샘플 — 자밀 워니 (정규 평균):`);
  const a = wonny.advanced;
  console.log(`  PER ${a.per.toFixed(1)} · USG% ${a.usgPct.toFixed(1)} · TS% ${a.tsPct.toFixed(1)}`);
  console.log(`  ORtg ${a.offRtg.toFixed(1)} · DRtg ${a.defRtg.toFixed(1)} · NetRtg ${a.netRtg.toFixed(1)}`);
}
